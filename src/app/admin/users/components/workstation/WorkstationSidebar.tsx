'use client'

import React from 'react'
import { WorkstationSidebarProps } from '../../types/workstation'

/**
 * WorkstationSidebar Component
 * Fixed left sidebar (280px) with:
 * - Quick statistics card
 * - Saved views buttons
 * - Advanced user filters
 * - Reset button
 */
export function WorkstationSidebar({
  isOpen = true,
  onClose,
  filters,
  onFiltersChange,
  stats,
  onAddUser,
  onReset,
  className
}: WorkstationSidebarProps) {
  return (
    <div className={`workstation-sidebar-content ${className || ''}`}>
      {/* Quick Stats Section */}
      <section className="sidebar-section">
        <h3 className="sidebar-title">Quick Stats</h3>
        {/* Stats content will be rendered here */}
      </section>

      {/* Saved Views Section */}
      <section className="sidebar-section">
        <h3 className="sidebar-title">Saved Views</h3>
        {/* Saved views buttons will be rendered here */}
      </section>

      {/* Filters Section */}
      <section className="sidebar-section sidebar-filters">
        <h3 className="sidebar-title">Filters</h3>
        {/* Advanced filters will be rendered here */}
      </section>

      {/* Reset Button */}
      <div className="sidebar-footer">
        <button
          onClick={onReset}
          className="sidebar-reset-btn"
          aria-label="Reset all filters"
        >
          Reset Filters
        </button>
      </div>
    </div>
  )
}

export default WorkstationSidebar
