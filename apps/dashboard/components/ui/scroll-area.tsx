import React from 'react';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', orientation = 'vertical', children, ...props }, ref) => {
    const scrollStyles = {
      vertical: 'overflow-y-auto overflow-x-hidden',
      horizontal: 'overflow-x-auto overflow-y-hidden',
      both: 'overflow-auto',
    };
    
    return (
      <div
        ref={ref}
        className={`relative ${scrollStyles[orientation]} ${className}`}
        {...props}
      >
        <div className="h-full w-full">
          {children}
        </div>
      </div>
    );
  }
);
ScrollArea.displayName = 'ScrollArea';