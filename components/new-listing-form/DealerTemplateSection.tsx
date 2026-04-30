import {
  DealerListingPicker,
  DealerSelector,
  FormSection,
  type DealerListingSummary,
} from "@/components/new-listing-form/ui";

export interface DealerOption {
  id: number;
  slug: string;
  name: string;
}

export function DealerTemplateSection({
  dealers,
  dealerId,
  listings,
  selectedMobileId,
  prefillingMobileId,
  deletingBackupId,
  onDealerChange,
  onSelectListing,
  onRequestDeleteDraft,
}: {
  dealers: DealerOption[];
  dealerId: string;
  listings: DealerListingSummary[];
  selectedMobileId: string | null;
  prefillingMobileId: string | null;
  deletingBackupId: number | null;
  onDealerChange: (dealerId: string) => void;
  onSelectListing: (mobileId: string, backupId: number | null) => void;
  onRequestDeleteDraft: (backupId: number) => void;
}) {
  return (
    <FormSection>
      <div className="mb-5">
        <div className="mt-2">
          <DealerSelector
            dealers={dealers}
            value={dealerId}
            onChange={onDealerChange}
          />
        </div>
        {dealerId ? (
          <div className="mt-3">
            <DealerListingPicker
              listings={listings}
              loading={false}
              selectedMobileId={selectedMobileId}
              prefillingMobileId={prefillingMobileId}
              deletingBackupId={deletingBackupId}
              error=""
              onSelect={onSelectListing}
              onRequestDeleteDraft={onRequestDeleteDraft}
            />
          </div>
        ) : null}
      </div>
    </FormSection>
  );
}
