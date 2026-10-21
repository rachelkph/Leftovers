import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AddDialog } from './components/AddDialog';
import { Toaster } from './components/Toaster';
import { TopBar } from './components/TopBar';
import { useAuth } from './lib/auth';
import { selectSettings, useStore } from './lib/store';
import { cloudEnabled } from './lib/supabase';
import { Customize } from './pages/Customize';
import { FridgePage } from './pages/FridgePage';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { SignIn } from './pages/SignIn';

export function App() {
  const settings = useStore(selectSettings);
  const [adding, setAdding] = useState(false);
  const location = useLocation();
  const { session, ready } = useAuth();

  // With cloud sync on: sign in first, then wait for your fridge to load from the cloud.
  if (cloudEnabled && session === null) return <SignIn />;
  if (cloudEnabled && (session === undefined || !ready)) {
    return (
      <div className="onboarding">
        <p className="meta" role="status">
          Opening your fridge…
        </p>
      </div>
    );
  }

  if (!settings.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="app">
      <TopBar onAdd={() => setAdding(true)} />
      <main className="app__main page-in" key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Home onAdd={() => setAdding(true)} />} />
          <Route path="/fridge" element={<FridgePage onAdd={() => setAdding(true)} />} />
          <Route path="/fridge/customize" element={<Customize />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {adding && <AddDialog shared={settings.mode === 'shared'} onClose={() => setAdding(false)} />}
      <Toaster />
    </div>
  );
}
