import React, { useEffect } from 'react';
import { Modal } from '../../../../components/ui/modal';
import type { Product, ProductUom } from '../../../../types/pos';
import type { PoLineItem } from '../order-types';
import { computeUomPrice } from '../order-math';

interface Props {
    prompt: { product: Product; qty: number } | null;
    lines: PoLineItem[];
    onSelect: (product: Product, uom: ProductUom, qty: number) => void;
    onClose: () => void;
}

export function UomSelectionModal({ prompt, lines, onSelect, onClose }: Props) {
    useEffect(() => {
        if (!prompt) return;

        const handleModalKey = (e: KeyboardEvent) => {
            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key, 10) - 1;
                const uoms = prompt.product.uoms || [];
                if (uoms[idx]) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(prompt.product, uoms[idx], prompt.qty);
                }
            } else if (e.key === 'Enter') {
                const uoms = prompt.product.uoms || [];
                if (uoms[0]) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(prompt.product, uoms[0], prompt.qty);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleModalKey, true);
        return () => window.removeEventListener('keydown', handleModalKey, true);
    }, [prompt, onSelect, onClose]);

    if (!prompt) return null;

    const { product, qty } = prompt;
    const uoms = product.uoms || [];

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Select Packaging Unit"
            description={`${product.sku} - ${product.name} (Qty: ${qty})`}
            maxWidth="md"
        >
            <div className="space-y-3 p-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    This item has multiple packaging tiers. Choose the packaging unit to add to active order lines (or press the number key):
                </p>
                <div className="space-y-2">
                    {uoms.map((uom, idx) => {
                        const price = computeUomPrice(product, uom);
                        const isExistingInOrder = lines.some(
                            (l) => l.product_id === product.id && l.product_uom_id === uom.id
                        );

                        return (
                            <button
                                key={uom.id}
                                type="button"
                                onClick={() => onSelect(product, uom, qty)}
                                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-brand bg-slate-50 hover:bg-brand/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-brand/10 text-left transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 group-hover:bg-brand group-hover:text-white group-hover:border-brand transition-colors">
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <span>{uom.name}</span>
                                            <span className="font-mono text-[11px] text-slate-400">
                                                ({uom.conversion_factor} {uom.conversion_factor === 1 ? 'pc' : 'pcs'}/pkg)
                                            </span>
                                            {isExistingInOrder && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">
                                                    In Order
                                                </span>
                                            )}
                                        </div>
                                        {uom.barcode && (
                                            <div className="text-[10px] font-mono text-slate-400">
                                                Barcode: {uom.barcode}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                        ₱{price}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        per {uom.name}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    <span>Press 1-9 to select • Esc to cancel</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
}
