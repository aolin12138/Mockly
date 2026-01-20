'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Simple “stick to bottom” conversation container.
 * - Auto-scrolls when new messages arrive (unless user has scrolled up).
 * - Shows an optional scroll-to-bottom button.
 */

export function Conversation({
  className = '',
  initial = 'smooth', // kept for API similarity
  resize = 'smooth',
  children,
}) {
  const containerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll when new content arrives
  useEffect(() => {
    if (!containerRef.current || !isAtBottom) return;
    const el = containerRef.current;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: initial,
    });
  }, [children, isAtBottom, initial]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 32; // px from bottom to still count as “at bottom”
    const diff = el.scrollHeight - el.clientHeight - el.scrollTop;
    setIsAtBottom(diff <= threshold);
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className='flex-1 overflow-y-auto px-4 md:px-6 py-4'
      >
        {children}
      </div>

      <ConversationScrollButton
        visible={!isAtBottom}
        onClick={() => {
          const el = containerRef.current;
          if (!el) return;
          el.scrollTo({
            top: el.scrollHeight,
            behavior: resize,
          });
        }}
      />
    </div>
  );
}

export function ConversationContent({ className = '', children }) {
  // spacing between bubbles is controlled here
  return <div className={className}>{children}</div>;
}

export function ConversationEmptyState({
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  icon = null,
  className = '',
  children,
  ...props
}) {
  if (children) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-center text-slate-500 text-xs md:text-sm ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center text-slate-500 text-xs md:text-sm ${className}`}
      {...props}
    >
      {icon && <div className='mb-2'>{icon}</div>}
      <div className='font-medium text-slate-700'>{title}</div>
      <div className='mt-1 max-w-sm'>{description}</div>
    </div>
  );
}

export function ConversationScrollButton({ visible, onClick, className = '', ...props }) {
  if (!visible) return null;

  return (
    <button
      type='button'
      onClick={onClick}
      className={
        'absolute bottom-3 right-4 inline-flex items-center rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur hover:bg-slate-50 transition ' +
        className
      }
      {...props}
    >
      ↓ New messages
    </button>
  );
}
