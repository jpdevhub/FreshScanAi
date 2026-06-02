import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-surface-mid ${className}`} {...props} />
  );
}
