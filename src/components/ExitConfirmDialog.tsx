import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "@/contexts/LanguageContext";

interface ExitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExitConfirmDialog({ open, onOpenChange }: ExitConfirmDialogProps) {
  const { t } = useTranslation();

  const handleExit = async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.exitApp();
    } catch {
      window.close();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[min(90vw,340px)] rounded-2xl p-5 gap-3">
        <AlertDialogHeader className="space-y-1.5">
          <AlertDialogTitle className="text-base text-center">{t("exit.title")}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-center">
            {t("exit.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center gap-3 pt-1">
          <AlertDialogCancel className="mt-0 flex-1">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleExit} className="flex-1">{t("exit.confirm")}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
