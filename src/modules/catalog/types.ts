export type CatalogCategoryStatus = "activa" | "inactiva";
export type CatalogProductStatus = "activo" | "inactivo";
export type CatalogProductType = "producto" | "servicio";

export type CatalogCategory = {
  createdAt: string;
  descripcion: string | null;
  estado: CatalogCategoryStatus;
  id: string;
  nombre: string;
  updatedAt: string;
};

export type CatalogProduct = {
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigo: string | null;
  createdAt: string;
  descripcion: string | null;
  estado: CatalogProductStatus;
  id: string;
  impuestoPorcentaje: number;
  moneda: string;
  nombre: string;
  precioBase: number;
  tipo: CatalogProductType;
  unidadMedida: string;
  updatedAt: string;
};

export type CatalogSummary = {
  categoriasActivas: number;
  productosActivos: number;
  totalProductos: number;
  totalServicios: number;
};

export type CatalogProductStatusFilter = CatalogProductStatus | "todos";
export type CatalogProductTypeFilter = CatalogProductType | "todos";
