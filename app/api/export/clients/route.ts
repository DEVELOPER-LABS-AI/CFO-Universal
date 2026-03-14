import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';
import { format } from '@fast-csv/format';
import { Readable } from 'stream';

const exportFiltersSchema = z.object({
  status: z.string().optional(),
  relationship_type: z.string().optional(),
  min_margin: z.coerce.number().min(-1000).max(1000).optional(),
  max_margin: z.coerce.number().min(-1000).max(1000).optional(),
  min_roi: z.coerce.number().min(-10000).max(10000).optional(),
  max_roi: z.coerce.number().min(-10000).max(10000).optional(),
  start_year: z.coerce.number().int().min(2000).max(2100).optional(),
  start_month: z.coerce.number().int().min(1).max(12).optional(),
  end_year: z.coerce.number().int().min(2000).max(2100).optional(),
  end_month: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().max(200).optional(),
});

// T146: CSV export API route using streaming pattern
// T147: Server-side streaming with fast-csv library: ReadableStream with 50-row chunks
// T148: Query params: filters (JSON), columns (comma-separated)

const CHUNK_SIZE = 50;

interface ExportFilters {
  status?: string;
  relationship_type?: string;
  min_margin?: number;
  max_margin?: number;
  min_roi?: number;
  max_roi?: number;
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
  search?: string;
}

const DEFAULT_COLUMNS = [
  'client_name',
  'status',
  'relationship_type',
  'month',
  'year',
  'revenue',
  'total_costs',
  'profit',
  'roi_percentage',
  'margin_percentage',
  'bdr_costs',
  'contractor_costs',
  'subscription_costs',
  'service_costs',
  'overhead_costs',
  'agency_costs',
];

const COLUMN_HEADERS: Record<string, string> = {
  client_name: 'Client Name',
  status: 'Status',
  relationship_type: 'Relationship Type',
  month: 'Month',
  year: 'Year',
  revenue: 'Revenue',
  total_costs: 'Total Costs',
  profit: 'Profit',
  roi_percentage: 'ROI %',
  margin_percentage: 'Margin %',
  bdr_costs: 'Staff Costs',
  contractor_costs: 'Contractor Costs',
  subscription_costs: 'Subscription Costs',
  service_costs: 'Service Costs',
  overhead_costs: 'Overhead Costs',
  agency_costs: 'Agency Costs',
  custom_margin_target: 'Target Margin %',
  start_date: 'Start Date',
  calculated_at: 'Calculated At',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate filters from query params
    const filtersParam = searchParams.get('filters');
    let filters: ExportFilters = {};
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        filters = exportFiltersSchema.parse(parsed);
      } catch {
        return NextResponse.json(
          { error: 'Invalid filter parameters' },
          { status: 400 }
        );
      }
    }

    // Parse columns from query params
    const columnsParam = searchParams.get('columns');
    const requestedColumns = columnsParam
      ? columnsParam.split(',').map((c) => c.trim())
      : DEFAULT_COLUMNS;

    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Build where clause for ClientROI data
    const clientWhere: any = {
      organization_id: organizationId,
      deleted_at: null,
    };

    if (filters.status) {
      clientWhere.status = filters.status;
    }

    if (filters.relationship_type) {
      clientWhere.relationship_type = filters.relationship_type;
    }

    if (filters.search) {
      clientWhere.name = { contains: filters.search, mode: 'insensitive' };
    }

    // Get matching clients
    const clients = await prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, status: true, relationship_type: true, custom_margin_target: true, start_date: true },
    });

    const clientIds = clients.map((c) => c.id);

    // Build where clause for ROI data
    const roiWhere: any = {
      client_id: { in: clientIds },
    };

    // Date range filters
    if (filters.start_year || filters.start_month) {
      roiWhere.OR = [
        { year: { gt: filters.start_year || 2000 } },
        {
          AND: [
            { year: filters.start_year || 2000 },
            { month: { gte: filters.start_month || 1 } },
          ],
        },
      ];
    }

    if (filters.end_year || filters.end_month) {
      roiWhere.AND = roiWhere.AND || [];
      roiWhere.AND.push({
        OR: [
          { year: { lt: filters.end_year || 2100 } },
          {
            AND: [
              { year: filters.end_year || 2100 },
              { month: { lte: filters.end_month || 12 } },
            ],
          },
        ],
      });
    }

    // Margin filters
    if (filters.min_margin !== undefined) {
      roiWhere.margin_percentage = roiWhere.margin_percentage || {};
      roiWhere.margin_percentage.gte = filters.min_margin;
    }

    if (filters.max_margin !== undefined) {
      roiWhere.margin_percentage = roiWhere.margin_percentage || {};
      roiWhere.margin_percentage.lte = filters.max_margin;
    }

    // ROI filters
    if (filters.min_roi !== undefined) {
      roiWhere.roi_percentage = roiWhere.roi_percentage || {};
      roiWhere.roi_percentage.gte = filters.min_roi;
    }

    if (filters.max_roi !== undefined) {
      roiWhere.roi_percentage = roiWhere.roi_percentage || {};
      roiWhere.roi_percentage.lte = filters.max_roi;
    }

    // Create a map of client details for quick lookup
    const clientMap = new Map(
      clients.map((c) => [
        c.id,
        {
          name: c.name,
          status: c.status,
          relationship_type: c.relationship_type,
          custom_margin_target: c.custom_margin_target,
          start_date: c.start_date,
        },
      ])
    );

    // Stream ROI data in chunks
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create CSV formatter
          const csvStream = format({
            headers: requestedColumns.map((col) => COLUMN_HEADERS[col] || col),
            writeHeaders: true,
          });

          // Convert Node.js stream to ReadableStream
          const nodeStream = Readable.from(csvStream);

          // Pipe CSV output to controller
          csvStream.on('data', (chunk) => {
            controller.enqueue(chunk);
          });

          csvStream.on('end', () => {
            controller.close();
          });

          csvStream.on('error', (error) => {
            controller.error(error);
          });

          // Fetch data in chunks and stream to CSV
          let skip = 0;
          let hasMore = true;

          while (hasMore) {
            const roiData = await prisma.clientROI.findMany({
              where: roiWhere,
              skip,
              take: CHUNK_SIZE,
              include: {
                client: { select: { id: true, name: true, status: true, relationship_type: true } },
              },
              orderBy: { calculated_at: 'desc' },
            });

            if (roiData.length === 0) {
              hasMore = false;
              break;
            }

            // Transform data for CSV export
            for (const roi of roiData) {
              const clientDetails = clientMap.get(roi.client_id);

              const row: Record<string, any> = {};

              requestedColumns.forEach((col) => {
                switch (col) {
                  case 'client_name':
                    row[col] = roi.client.name;
                    break;
                  case 'status':
                    row[col] = roi.client.status;
                    break;
                  case 'relationship_type':
                    row[col] = roi.client.relationship_type;
                    break;
                  case 'month':
                    row[col] = roi.month;
                    break;
                  case 'year':
                    row[col] = roi.year;
                    break;
                  case 'revenue':
                    row[col] = Number(roi.revenue).toFixed(2);
                    break;
                  case 'total_costs':
                    row[col] = Number(roi.total_costs).toFixed(2);
                    break;
                  case 'profit':
                    row[col] = Number(roi.profit).toFixed(2);
                    break;
                  case 'roi_percentage':
                    row[col] = Number(roi.roi_percentage).toFixed(2);
                    break;
                  case 'margin_percentage':
                    row[col] = Number(roi.margin_percentage).toFixed(2);
                    break;
                  case 'bdr_costs':
                    row[col] = Number(roi.bdr_costs).toFixed(2);
                    break;
                  case 'contractor_costs':
                    row[col] = Number(roi.contractor_costs).toFixed(2);
                    break;
                  case 'subscription_costs':
                    row[col] = Number(roi.subscription_costs).toFixed(2);
                    break;
                  case 'service_costs':
                    row[col] = Number(roi.service_costs).toFixed(2);
                    break;
                  case 'overhead_costs':
                    row[col] = Number(roi.overhead_costs).toFixed(2);
                    break;
                  case 'agency_costs':
                    row[col] = Number(roi.agency_costs).toFixed(2);
                    break;
                  case 'custom_margin_target':
                    row[col] = clientDetails?.custom_margin_target
                      ? Number(clientDetails.custom_margin_target).toFixed(2)
                      : '';
                    break;
                  case 'start_date':
                    row[col] = clientDetails?.start_date
                      ? new Date(clientDetails.start_date).toISOString().split('T')[0]
                      : '';
                    break;
                  case 'calculated_at':
                    row[col] = new Date(roi.calculated_at).toISOString();
                    break;
                  default:
                    row[col] = '';
                }
              });

              csvStream.write(row);
            }

            skip += CHUNK_SIZE;

            // If we got fewer rows than CHUNK_SIZE, we're done
            if (roiData.length < CHUNK_SIZE) {
              hasMore = false;
            }
          }

          // End the CSV stream
          csvStream.end();
        } catch (error) {
          console.error('CSV export error:', error);
          controller.error(error);
        }
      },
    });

    // Return streaming response with CSV headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="clients-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
