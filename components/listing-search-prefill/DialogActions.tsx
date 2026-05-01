import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

interface DialogActionsProps {
  filtersVisible: boolean;
  hasData: boolean;
  hasError: boolean;
  loading: boolean;
  profileSaving: boolean;
  resultsLoading: boolean;
  savedSearchEnabled: boolean;
  onClose: () => void;
  onResetSearchProfile: () => void;
  onSaveSearchProfile: () => void;
  onShowAllResults: () => void;
  onShowFilters: () => void;
  onShowFirstSevenResults: () => void;
  onSubmitAll: () => void;
  onSubmitFirstSeven: () => void;
}

export function DialogActions({
  filtersVisible,
  hasData,
  hasError,
  loading,
  profileSaving,
  resultsLoading,
  savedSearchEnabled,
  onClose,
  onResetSearchProfile,
  onSaveSearchProfile,
  onShowAllResults,
  onShowFilters,
  onShowFirstSevenResults,
  onSubmitAll,
  onSubmitFirstSeven,
}: DialogActionsProps) {
  const baseDisabled = !hasData || loading || hasError;

  return (
    <DialogFooter className="border-slate-500/60 bg-slate-800/85">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      {!filtersVisible && (
        <Button variant="outline" onClick={onShowFilters}>
          Show filters
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={onSaveSearchProfile} disabled={baseDisabled || profileSaving}>
          {profileSaving ? 'Saving...' : 'Save search values'}
        </Button>
        <Button variant="outline" onClick={onResetSearchProfile} disabled={baseDisabled || profileSaving || !savedSearchEnabled}>
          Reset saved
        </Button>
        <Button onClick={onSubmitAll} disabled={baseDisabled}>
          Submit all
        </Button>
        <Button onClick={onSubmitFirstSeven} disabled={baseDisabled}>
          Submit first 7
        </Button>
        <Button onClick={onShowAllResults} disabled={baseDisabled || resultsLoading}>
          Show results for all filters
        </Button>
        <Button onClick={onShowFirstSevenResults} disabled={baseDisabled || resultsLoading}>
          Show results for first 7 filters
        </Button>
      </div>
    </DialogFooter>
  );
}
