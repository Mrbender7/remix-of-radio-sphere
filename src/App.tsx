import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const initNative = async () => {
      try {
        if (window.hasOwnProperty('Capacitor')) {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        }
      } catch (e) { console.log("Capacitor not ready"); }
    };
    initNative();

  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
