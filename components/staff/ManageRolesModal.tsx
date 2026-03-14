'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Lock } from 'lucide-react';
import { createStaffRole, deleteStaffRole } from '@/app/actions/staff-role-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface ManageRolesModalProps {
  roles: Array<{
    id: string;
    name: string;
    display_name: string;
    is_system: boolean;
  }>;
  trigger?: React.ReactNode;
}

export function ManageRolesModal({ roles, trigger }: ManageRolesModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ name: '', display_name: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.display_name.trim()) return;

    setIsAdding(true);
    try {
      await createStaffRole({
        name: newRole.name || newRole.display_name,
        display_name: newRole.display_name,
      });
      toast.success(`Role "${newRole.display_name}" created`);
      setNewRole({ name: '', display_name: '' });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create role');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, displayName: string) => {
    setDeletingId(id);
    try {
      await deleteStaffRole(id);
      toast.success(`Role "${displayName}" deleted`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete role');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Manage Roles</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Staff Roles</DialogTitle>
          <DialogDescription>
            Add or remove custom roles. System roles cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing roles */}
          <div className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.display_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {role.name}
                  </Badge>
                  {role.is_system && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                {!role.is_system && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === role.id}
                    onClick={() => handleDelete(role.id, role.display_name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add new role */}
          <form onSubmit={handleAdd} className="space-y-3 border-t pt-4">
            <Label>Add Custom Role</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Display name (e.g. Project Manager)"
                value={newRole.display_name}
                onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                required
              />
              <Button type="submit" disabled={isAdding || !newRole.display_name.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                {isAdding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
