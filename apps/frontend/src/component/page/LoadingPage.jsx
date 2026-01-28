import React from 'react';

export function LoadingPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-100 px-4'>
      <div className='flex flex-col items-center gap-3 text-slate-700'>
        <div className='h-12 w-12 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin' aria-label='Loading' />
        <p className='text-sm font-medium'>Loading interview feedback…</p>
      </div>
    </div>
  );
}

export default LoadingPage;
