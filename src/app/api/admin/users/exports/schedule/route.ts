import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { hasPermission } from '@/lib/permissions'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/admin/users/exports/schedule
 * List all export schedules for the current user/tenant
 */
export async function GET(request: NextRequest) {
  return requireTenantContext(request, async (context) => {
    try {
      // Rate limiting
      const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
      const { success } = await rateLimit(identifier)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      // Permission check
      const hasAccess = await hasPermission(context.userId, 'admin:users:export')
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Get schedules from database
      const schedules = await prisma.exportSchedule.findMany({
        where: {
          tenantId: context.tenantId
        },
        include: {
          _count: {
            select: { executions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        success: true,
        schedules: schedules.map(s => ({
          ...s,
          executionCount: s._count.executions
        }))
      })
    } catch (error) {
      console.error('Failed to fetch export schedules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch export schedules' },
        { status: 500 }
      )
    }
  })
}

/**
 * POST /api/admin/users/exports/schedule
 * Create a new export schedule
 */
export async function POST(request: NextRequest) {
  return requireTenantContext(request, async (context) => {
    try {
      // Rate limiting
      const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
      const { success } = await rateLimit(identifier)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      // Permission check
      const hasAccess = await hasPermission(context.userId, 'admin:users:export')
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Parse request body
      const body = await request.json()
      const {
        name,
        description,
        frequency,
        format,
        recipients,
        dayOfWeek,
        dayOfMonth,
        time,
        emailSubject,
        emailBody,
        filterPresetId,
        isActive = true
      } = body

      // Validate required fields
      if (!name || !frequency || !format || !recipients || recipients.length === 0) {
        return NextResponse.json(
          { error: 'Missing required fields: name, frequency, format, recipients' },
          { status: 400 }
        )
      }

      // Validate format
      if (!['csv', 'xlsx', 'json', 'pdf'].includes(format)) {
        return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (recipients.some((email: string) => !emailRegex.test(email))) {
        return NextResponse.json({ error: 'One or more recipient emails are invalid' }, { status: 400 })
      }

      // Check schedule limit (max 20 per tenant)
      const existingSchedules = await prisma.exportSchedule.count({
        where: { tenantId: context.tenantId }
      })

      if (existingSchedules >= 20) {
        return NextResponse.json(
          { error: 'Maximum number of export schedules (20) reached for this tenant' },
          { status: 400 }
        )
      }

      // Create the schedule in database
      const schedule = await prisma.exportSchedule.create({
        data: {
          id: crypto.getRandomUUID(),
          name,
          description,
          frequency,
          format,
          recipients,
          dayOfWeek: dayOfWeek || null,
          dayOfMonth: dayOfMonth || null,
          time: time || '09:00',
          emailSubject,
          emailBody,
          filterPresetId: filterPresetId || null,
          isActive,
          tenantId: context.tenantId,
          userId: context.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        schedule,
        message: 'Export schedule created successfully'
      })
    } catch (error) {
      console.error('Failed to create export schedule:', error)
      return NextResponse.json(
        { error: 'Failed to create export schedule' },
        { status: 500 }
      )
    }
  })
}

/**
 * PATCH /api/admin/users/exports/schedule
 * Update multiple schedules or bulk operations
 */
export async function PATCH(request: NextRequest) {
  return requireTenantContext(request, async (context) => {
    try {
      const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
      const { success } = await rateLimit(identifier)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      const hasAccess = await hasPermission(context.userId, 'admin:users:export')
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const body = await request.json()
      const { action, scheduleIds } = body

      // Toggle active status for multiple schedules
      if (action === 'toggleActive' && scheduleIds && Array.isArray(scheduleIds)) {
        await prisma.exportSchedule.updateMany({
          where: {
            id: { in: scheduleIds }
          },
          data: {
            isActive: { not: true }
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Schedules updated'
        })
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
      console.error('Failed to update export schedules:', error)
      return NextResponse.json(
        { error: 'Failed to update export schedules' },
        { status: 500 }
      )
    }
  })
}

/**
 * DELETE /api/admin/users/exports/schedule
 * Delete export schedules (with query parameter ?ids=id1,id2,...)
 */
export async function DELETE(request: NextRequest) {
  return requireTenantContext(request, async (context) => {
    try {
      const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
      const { success } = await rateLimit(identifier)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      const hasAccess = await hasPermission(context.userId, 'admin:users:export')
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { searchParams } = new URL(request.url)
      const ids = searchParams.get('ids')?.split(',') || []

      if (ids.length === 0) {
        return NextResponse.json({ error: 'No schedule IDs provided' }, { status: 400 })
      }

      // Delete schedules and their executions
      await prisma.exportScheduleExecution.deleteMany({
        where: {
          scheduleId: { in: ids }
        }
      })

      const deleted = await prisma.exportSchedule.deleteMany({
        where: {
          id: { in: ids }
        }
      })

      return NextResponse.json({
        success: true,
        deletedCount: deleted.count,
        message: `${deleted.count} schedule(s) deleted`
      })
    } catch (error) {
      console.error('Failed to delete export schedules:', error)
      return NextResponse.json(
        { error: 'Failed to delete export schedules' },
        { status: 500 }
      )
    }
  })
}
