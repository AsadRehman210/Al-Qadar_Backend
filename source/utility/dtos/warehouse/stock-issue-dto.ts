export interface stockIssueItemDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  qty: number;
}

export interface stockIssueDto {
  id: string;
  issueNo?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  date?: Date | null;
  issueType?: string | null;
  issuedTo?: string | null;
  reference?: string | null;
  notes?: string | null;
  issuedBy?: string | null;
  items?: stockIssueItemDto[];
  createdAt?: Date | null;
}
