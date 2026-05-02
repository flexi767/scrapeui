"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import type { Region, City } from "@/lib/mobile-bg/regions";
import {
  DealerTemplateSection,
  type DealerOption,
} from "@/components/new-listing-form/DealerTemplateSection";
import { DraftDeleteDialog } from "@/components/new-listing-form/DraftDeleteDialog";
import { SavedDraftView } from "@/components/new-listing-form/SavedDraftView";
import {
  getSelectedOptionCount,
  sortMakeOptions,
} from "@/components/new-listing-form/autocomplete";
import type { DealerListingSummary } from "@/components/new-listing-form/dealer-picker";
import {
  BATTERY_FUELS,
  EMPTY,
  type FormState,
} from "@/components/new-listing-form/constants";
import { DescriptionContactSection } from "@/components/new-listing-form/DescriptionContactSection";
import { ExtrasSection } from "@/components/new-listing-form/ExtrasSection";
import { LocationSection } from "@/components/new-listing-form/LocationSection";
import { PricingSection } from "@/components/new-listing-form/PricingSection";
import { SubmitActions } from "@/components/new-listing-form/SubmitActions";
import { VehicleDetailsSection } from "@/components/new-listing-form/VehicleDetailsSection";
import {
  createDraft,
  deleteDraftById,
  fetchCities,
  fetchListingPrefill,
  fetchMakes,
  updateDraft,
} from "@/components/new-listing-form/api";
import {
  applyMakeSelection,
  findSelectedMake,
  makeOptionsFromEntries,
  modelOptionsFromMake,
  validateListingForm,
} from "@/components/new-listing-form/helpers";
interface Props {
  makes: MakeEntry[];
  transmissions: string[];
  fuels: string[];
  bodyTypes: string[];
  regions: Region[];
  colors: string[];
  dealers: DealerOption[];
  initialDealerListingsByDealer: Record<string, DealerListingSummary[]>;
  initialDealerId?: string;
}


export default function NewListingForm({
  makes: initialMakes,
  transmissions,
  fuels,
  regions,
  dealers,
  initialDealerListingsByDealer,
  initialDealerId = "",
}: Props) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    dealerId: initialDealerId,
  }));
  const [makes, setMakes] = useState<MakeEntry[]>(initialMakes);
  const [makesLoading, setMakesLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedTemplateMobileId, setSelectedTemplateMobileId] = useState<
    string | null
  >(null);
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);
  const [prefillingMobileId, setPrefillingMobileId] = useState<string | null>(
    null,
  );
  const [dealerListingsByDealer, setDealerListingsByDealer] = useState(
    initialDealerListingsByDealer,
  );
  const [deletingBackupId, setDeletingBackupId] = useState<number | null>(null);
  const [draftDeleteCandidateId, setDraftDeleteCandidateId] = useState<
    number | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMode, setSavedMode] = useState<"created" | "updated">("created");
  const [savedBackupId, setSavedBackupId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [openAutocomplete, setOpenAutocomplete] = useState<
    "make" | "model" | null
  >(null);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const selectedMake = useMemo(
    () => findSelectedMake(makes, form.make),
    [form.make, makes],
  );
  const makeOptions = useMemo(
    () => sortMakeOptions(makeOptionsFromEntries(makes)),
    [makes],
  );
  const modelOptions = useMemo(
    () => modelOptionsFromMake(selectedMake),
    [selectedMake],
  );
  const selectedMakeCount = useMemo(
    () => getSelectedOptionCount(makeOptions, form.make),
    [form.make, makeOptions],
  );
  const selectedModelCount = useMemo(
    () => getSelectedOptionCount(modelOptions, form.model),
    [form.model, modelOptions],
  );
  const showBatteryFields = BATTERY_FUELS.has(form.fuel);
  const dealerListings = useMemo(
    () => (form.dealerId ? (dealerListingsByDealer[form.dealerId] ?? []) : []),
    [dealerListingsByDealer, form.dealerId],
  );
  const draftDeleteCandidate = useMemo(
    () =>
      dealerListings.find(
        (listing) => listing.backupId === draftDeleteCandidateId,
      ) ?? null,
    [dealerListings, draftDeleteCandidateId],
  );

  useEffect(() => {
    setDealerListingsByDealer(initialDealerListingsByDealer);
  }, [initialDealerListingsByDealer]);

  const loadCities = useCallback(async (regionValue: string) => {
    if (!regionValue) {
      setCities([]);
      return;
    }

    setCitiesLoading(true);
    try {
      setCities(await fetchCities(regionValue));
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  const loadMakes = useCallback(
    async (pubtype: string) => {
      setMakesLoading(true);
      try {
        setMakes(await fetchMakes(pubtype));
      } catch {
        setMakes(initialMakes);
      } finally {
        setMakesLoading(false);
      }
    },
    [initialMakes],
  );

  function resetForm() {
    setForm({
      ...EMPTY,
      dealerId: initialDealerId,
    });
    setCities([]);
    setSelectedTemplateMobileId(null);
    setSelectedBackupId(null);
    setDraftDeleteCandidateId(null);
    setPrefillingMobileId(null);
    setError("");
    setSaved(false);
    setSavedMode("created");
    setSavedBackupId(null);
  }

  function toggleExtra(category: string, label: string) {
    setForm((prev) => {
      const current = prev.extras[category] ?? [];
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];
      return { ...prev, extras: { ...prev.extras, [category]: next } };
    });
  }

  async function onRegionChange(regionValue: string) {
    setField("region", regionValue);
    setField("city", "");
    await loadCities(regionValue);
  }

  async function onCategoryChange(pubtype: string) {
    setField("pubtype", pubtype);
    setField("make", "");
    setField("model", "");
    await loadMakes(pubtype);
  }

  function updateMake(value: string) {
    setOpenAutocomplete("model");
    setForm((prev) => applyMakeSelection(prev, makes, value));
  }

  function validateForm(): boolean {
    setError("");
    const validationError = validateListingForm(form);
    if (validationError) {
      setError(validationError);
      return false;
    }
    return true;
  }

  async function saveNewDraft() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const data = await createDraft(form);
      const nextBackupId = typeof data.id === "number" ? data.id : null;
      setSavedBackupId(nextBackupId);
      setSelectedBackupId(nextBackupId);
      setSavedMode("created");
      setSaved(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveExistingListing() {
    if (!selectedBackupId) {
      await saveNewDraft();
      return;
    }
    if (!validateForm()) return;

    setSaving(true);
    try {
      const data = await updateDraft(selectedBackupId, form);
      setSavedBackupId(typeof data.id === "number" ? data.id : selectedBackupId);
      setSavedMode("updated");
      setSaved(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function prefillFromListing(mobileId: string, backupId: number | null) {
    if (!form.dealerId) return;

    setPrefillingMobileId(mobileId || String(backupId));
    setError("");

    try {
      const data = await fetchListingPrefill({
        dealerId: form.dealerId,
        mobileId,
        backupId,
      });
      const nextForm = data.form;
      if (nextForm.pubtype !== form.pubtype) {
        await loadMakes(nextForm.pubtype);
      }
      if (nextForm.region) {
        await loadCities(nextForm.region);
      } else {
        setCities([]);
      }
      setForm(nextForm);
      setSelectedTemplateMobileId(mobileId || String(backupId));
      setSelectedBackupId(backupId);
      setOpenAutocomplete(null);
    } catch (prefillError) {
      setError((prefillError as Error).message);
    } finally {
      setPrefillingMobileId(null);
    }
  }

  async function deleteDraft(backupId: number) {
    if (!form.dealerId || deletingBackupId != null) return;

    setDeletingBackupId(backupId);
    setError("");

    try {
      await deleteDraftById(backupId);

      setDealerListingsByDealer((prev) => ({
        ...prev,
        [form.dealerId]: (prev[form.dealerId] ?? []).filter(
          (listing) => listing.backupId !== backupId,
        ),
      }));
      if (selectedTemplateMobileId === String(backupId)) {
        setSelectedTemplateMobileId(null);
        setSelectedBackupId(null);
      }
      setDraftDeleteCandidateId(null);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingBackupId(null);
    }
  }

  if (saved) {
    const backupId = savedBackupId ?? selectedBackupId;
    return (
      <SavedDraftView
        form={form}
        mode={savedMode}
        backupId={backupId}
        onEditDetails={() => setSaved(false)}
        onNewListing={resetForm}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <DraftDeleteDialog
        candidate={draftDeleteCandidate}
        deletingBackupId={deletingBackupId}
        onOpenChange={(open) => {
          if (!open && deletingBackupId == null) {
            setDraftDeleteCandidateId(null);
          }
        }}
        onCancel={() => setDraftDeleteCandidateId(null)}
        onConfirm={(backupId) => void deleteDraft(backupId)}
      />
      <DealerTemplateSection
        dealers={dealers}
        dealerId={form.dealerId}
        listings={dealerListings}
        selectedMobileId={selectedTemplateMobileId}
        prefillingMobileId={prefillingMobileId}
        deletingBackupId={deletingBackupId}
        onDealerChange={(value) => {
          setField("dealerId", value);
          setSelectedTemplateMobileId(null);
          setSelectedBackupId(null);
          setDraftDeleteCandidateId(null);
        }}
        onSelectListing={(mobileId, backupId) =>
          void prefillFromListing(mobileId, backupId)
        }
        onRequestDeleteDraft={setDraftDeleteCandidateId}
      />

      <VehicleDetailsSection
        form={form}
        makesLoading={makesLoading}
        makeOptions={makeOptions}
        modelOptions={modelOptions}
        selectedMakeCount={selectedMakeCount}
        selectedModelCount={selectedModelCount}
        openAutocomplete={openAutocomplete}
        transmissions={transmissions}
        fuels={fuels}
        showBatteryFields={showBatteryFields}
        setField={setField}
        onOpenAutocompleteChange={setOpenAutocomplete}
        onUpdateMake={updateMake}
        onCategoryChange={onCategoryChange}
      />

      <PricingSection form={form} setField={setField} />

      <LocationSection
        form={form}
        regions={regions}
        cities={cities}
        citiesLoading={citiesLoading}
        setField={setField}
        onRegionChange={onRegionChange}
      />

      <ExtrasSection extras={form.extras} onToggle={toggleExtra} />

      <DescriptionContactSection form={form} setField={setField} />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <SubmitActions
        saving={saving}
        selectedBackupId={selectedBackupId}
        onSave={() => void saveExistingListing()}
        onSaveNew={() => void saveNewDraft()}
        onReset={resetForm}
      />
    </div>
  );
}
