'use client';

import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin mr-3 text-blue-600" />
              <div>
                <div className="text-lg font-medium">Loading Dashboard...</div>
                <div className="text-sm text-gray-500">Please wait while we prepare your data</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}