import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';

import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main">
        <Navbar onMenu={() => setOpen(true)} />
        <main className="page">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  );
}
