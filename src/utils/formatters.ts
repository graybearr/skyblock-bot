export function formatNumber(num: number | undefined): string {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
}

export function getTopItems(category: any): string {
    if (!category || !category.items || category.items.length === 0) return '아이템 없음';
    
    return category.items
        .sort((a: any, b: any) => (b.price || 0) - (a.price || 0))
        .slice(0, 5) // 상위 5개
        .map((item: any) => `${item.name} **(${formatNumber(item.price)})**`)
        .join('\n');
}