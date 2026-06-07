import { OwnListingRow } from "@/lib/queries";
import { normalizeCarsBgShortTitle } from "@/lib/cars-bg/title";

export interface OwnListingEditForm {
  title: string;
  carsbg_title: string;
  current_price: number;
  vat: string;
  kaparo: number;
  ad_status: string;
}

export const EMPTY_OWN_LISTING_EDIT_FORM: OwnListingEditForm = {
  title: "",
  carsbg_title: "",
  current_price: 0,
  vat: "",
  kaparo: 0,
  ad_status: "none",
};

export function getOwnListingRowKey(row: OwnListingRow): string {
  return row.mobile_id ? `mobile-${row.mobile_id}` : `backup-${row.backup_id}`;
}

export function getEditFormFromOwnListing(row: OwnListingRow): OwnListingEditForm {
  return {
    title: row.title ?? "",
    carsbg_title: normalizeCarsBgShortTitle(row.carsbg_title),
    current_price: row.current_price ?? 0,
    vat: row.vat ?? "",
    kaparo: row.kaparo ?? 0,
    ad_status: row.ad_status ?? "none",
  };
}

export function getOwnListingSaveEndpoint(row: OwnListingRow): string {
  return row.mobile_id
    ? `/api/listings/${row.mobile_id}`
    : `/api/editown/backups/${row.backup_id}`;
}

export function buildOwnListingPatchBody(form: OwnListingEditForm) {
  return {
    title: form.title,
    carsbg_title: normalizeCarsBgShortTitle(form.carsbg_title),
    current_price: form.current_price,
    vat: form.vat,
    kaparo: form.kaparo,
    ad_status: form.ad_status,
  };
}
