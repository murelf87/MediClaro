// Capa de proveedores farmacológicos. Cada país/fuente implementa esta interfaz.
// Todo dato devuelto lleva su fuente (Source) para poder citarlo en la app.

export type Source = { provider: string; label: string; url: string | null; section?: string; fetchedAt: string };

export type MedicationSummary = {
  /** Identificador estable de la fuente oficial (nregistro en CIMA; SPL SET ID en EE. UU.). */
  id: string;
  nombre: string;
  laboratorio: string | null;
  principiosActivos: { nombre: string; cantidad: string | null; unidad: string | null }[];
  formaFarmaceutica: string | null;
  dosis: string | null;
  /** Presentaciones/códigos de paquete. `cn` conserva el nombre histórico del contrato móvil. */
  presentaciones: { cn: string; nombre: string }[];
  receta: boolean;
  comercializado: boolean;
  fotoUrl: string | null;
  source: Source;
};

export type LeafletSection = { key: 'indicaciones' | 'antes' | 'posologia' | 'efectos' | 'conservacion'; title: string; text: string; source: Source };

export interface MedicationDataProvider {
  readonly id: string;
  readonly country: string;
  searchMedication(query: string, limit?: number): Promise<MedicationSummary[]>;
  findByBarcode(code: string): Promise<MedicationSummary | null>;
  findByNationalCode(code: string): Promise<MedicationSummary | null>;
  getMedication(id: string): Promise<MedicationSummary | null>;
  getLeaflet(id: string): Promise<LeafletSection[]>;
  getTechnicalSheetUrl(id: string): Promise<string | null>;
  getLeafletUrl(id: string): Promise<string | null>;
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) { super(`${provider} no disponible`); }
}

export class ProviderNotSupportedError extends Error {
  constructor(country: string) { super(`País no soportado: ${country}`); }
}
