'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ContractorPortalHeaderProps {
  contractorName: string
}

export function ContractorPortalHeader({ contractorName }: ContractorPortalHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
          {contractorName}
        </h2>
      </div>
    </header>
  )
}
