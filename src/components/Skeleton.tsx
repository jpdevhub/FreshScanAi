import React from "react";

export default function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pulse bg-surface-mid ${className}`} {...props} />
  );
}
