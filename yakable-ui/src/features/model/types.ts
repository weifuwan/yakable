export interface ModelSelection {
  provider: string;
  model: string;
}

export interface ModelOption extends ModelSelection {
  label: string;
}
