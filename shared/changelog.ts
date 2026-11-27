export interface Product {
  id: string;
  name: string;
}
export interface PullLink {
  url: string;
  title: string;
}
export interface EntryDraft {
  week: string;
  productId: string;
  title: string;
  changed: string;
  benefit: string;
  links: string[];
}
export interface ChangelogEntry extends Omit<EntryDraft, 'links'> {
  id: string;
  revision: number;
  authorId: string;
  author: string;
  product: string;
  links: PullLink[];
}
export interface ChangelogView {
  products: Product[];
  entries: ChangelogEntry[];
}
