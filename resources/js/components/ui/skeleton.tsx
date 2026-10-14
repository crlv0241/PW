import React from 'react';

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
    return (
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                    {Array.from({ length: columns }).map((_, cIdx) => (
                        <td key={cIdx} className="px-5 py-4">
                            <div
                                className="h-4 rounded bg-slate-200 dark:bg-slate-800"
                                style={{
                                    width: cIdx === 0 ? '40%' : cIdx === 1 ? '70%' : '50%',
                                }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
}
