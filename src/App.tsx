/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { AsistenteScreen } from './components/AsistenteScreen';
import { GacetasScreen } from './components/GacetasScreen';
import { AgenteExtractorScreen } from './components/AgenteExtractorScreen';
import { RAGLangGraphScreen } from './components/RAGLangGraphScreen';
import { LeyesScreen } from './components/LeyesScreen';
import {
  CitationModal,
  DictamenModal,
  CeleryLogsModal,
  ComparativeTableModal,
  NotificationsModal,
  ProfileModal,
} from './components/Modals';
import { LegalCitation, LegalOpinion, NavTab, UserProfile, LawCatalogItem } from './types';
import storage, { getActiveUser, getAccount, buildProfileFromAccount, setUser } from './lib/db';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const email = getActiveUser();
    if (!email) return null;
    const account = getAccount(email);
    if (!account) { setUser(null); return null; }
    return storage.session.get() ?? buildProfileFromAccount(account);
  });
  const [currentTab, setCurrentTab] = useState<NavTab>(() => storage.ui.getTab());

  // Modal States
  const [selectedCitation, setSelectedCitation] = useState<LegalCitation | null>(null);
  const [selectedDictamen, setSelectedDictamen] = useState<LegalOpinion | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isComparativeOpen, setIsComparativeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleAuthenticated = (profile: UserProfile) => {
    setUserProfile(profile);
    storage.session.set(profile);
  };

  const handleLogout = () => {
    storage.session.clear();
    setUser(null);
    setUserProfile(null);
    setCurrentTab('asistente');
    storage.ui.setTab('asistente');
  };

  const handleSelectLaw = (law: LawCatalogItem) => {
    setSelectedCitation({
      lawName: law.title,
      article: `Artículos 1 al ${law.articlesCount}`,
      sourceRef: law.source,
      quote: law.description,
    });
  };

  const navigateToLaw = (law: LawCatalogItem) => {
    setCurrentTab('leyes');
    storage.ui.setTab('leyes');
    handleSelectLaw(law);
  };

  return (
    <AnimatePresence mode="wait">
      {!userProfile ? (
        <motion.div
          key="auth-view"
          initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <AuthScreen onAuthenticated={handleAuthenticated} />
        </motion.div>
      ) : (
        <motion.div
          key="main-app-view"
          initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#f8f9ff] font-sans text-on-surface antialiased flex flex-col min-h-screen selection:bg-secondary-fixed selection:text-on-secondary-fixed"
        >
          {/* Top Header */}
          <Header
            currentTab={currentTab}
            userProfile={userProfile}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
          />

          {/* Main View Area with Bespoke Spring-Damped Screen Transitions */}
          <main className="flex flex-col relative w-full pt-28 pb-16 bg-[#f8f9ff] min-h-screen overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                {currentTab === 'asistente' && (
                  <AsistenteScreen
                    userProfile={userProfile}
                    onOpenCitation={(c) => setSelectedCitation(c)}
                    onOpenDictamen={(o) => setSelectedDictamen(o)}
                    onNavigateToLaw={navigateToLaw}
                  />
                )}

                {currentTab === 'gacetas' && (
                  <GacetasScreen
                    userProfile={userProfile}
                    onOpenLogs={() => setIsLogsOpen(true)}
                    onOpenComparative={() => setIsComparativeOpen(true)}
                    onNavigateToTab={(t) => { setCurrentTab(t); storage.ui.setTab(t); }}
                  />
                )}

                {currentTab === 'extractor' && <AgenteExtractorScreen userProfile={userProfile} />}

                {currentTab === 'rag_indexer' && <RAGLangGraphScreen userProfile={userProfile} />}

                {currentTab === 'leyes' && (
                  <LeyesScreen
                    userProfile={userProfile}
                    onSelectLaw={handleSelectLaw}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Bottom Floating Navigation Bar */}
          <BottomNav currentTab={currentTab} onSelectTab={(t) => { setCurrentTab(t); storage.ui.setTab(t); }} />

          {/* Interactive Modals */}
          <CitationModal
            citation={selectedCitation}
            onClose={() => setSelectedCitation(null)}
          />

          <DictamenModal
            opinion={selectedDictamen}
            onClose={() => setSelectedDictamen(null)}
            userProfile={userProfile}
          />

          <CeleryLogsModal
            isOpen={isLogsOpen}
            onClose={() => setIsLogsOpen(false)}
          />

          <ComparativeTableModal
            isOpen={isComparativeOpen}
            onClose={() => setIsComparativeOpen(false)}
          />

          <NotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
          />

          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            userProfile={userProfile}
            onLogout={handleLogout}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
