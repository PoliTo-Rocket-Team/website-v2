import { syncUsers } from '@/lib/sync-user';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await syncUsers();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
