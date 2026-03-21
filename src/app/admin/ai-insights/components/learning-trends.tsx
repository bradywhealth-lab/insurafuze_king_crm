/**
 * Learning Trends Chart Component
 *
 * Displays AI learning trends over time using Recharts.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp } from 'lucide-react'

export function LearningTrends() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Trends</CardTitle>
        <CardDescription>AI interaction volume and success rates over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          {/* Placeholder - in production, fetch actual trend data */}
          <div className="text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Trend data coming soon</p>
            <p className="text-xs mt-1">Requires historical aggregation</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LearningTrendsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}

export { LearningTrendsSkeleton as Skeleton }
