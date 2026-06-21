import React from "react";
import { useAppBridge } from "./useAppBridge";
import { AuthScreen } from "./AuthScreen";
import { HotelRateMasterScreen } from "./HotelRateMasterScreen";
import { ManageRatesScreen } from "./ManageRatesScreen";
import { DashboardScreen } from "./DashboardScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { VoucherEntryScreen } from "./VoucherEntryScreen";
import { SavedVouchersScreen } from "./SavedVouchersScreen";
import { Sidebar } from "./Sidebar";
import { TourExplorerPanel } from "./TourExplorerPanel";
import { MenuBar } from "./MenuBar";
import { LoadingScreen } from "./LoadingScreen";
import { ReportIssueModal } from "./ReportIssueModal";
import { SearchOverlay } from "./SearchOverlay";
import { defaultVoucher } from "../domain/defaultVoucher";
import { withAccountDefaults } from "../domain/voucherUtils";
import type { VoucherRecord } from "../../electron/shared/types";

type ActiveView =
  | "entry"
  | "dashboard"
  | "register"
  | "rate-master"
  | "manage-rates"
  | "settings"
  | "profile";

export function App() {
  const {
    themeClass,
    activeView,
    setActiveView,
    actionState,
    previewMode,
    setPreviewMode,
    previewPos,
    windowSize,
    isDraggingPreview,
    startDragPreview,
    documentHistory,
    voucherRevisions,
    voucherRegister,
    voucherFilters,
    setVoucherFilters,
    isLoadingRegister,
    openingVoucherId,
    statusUpdatingId,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    notices,
    clearNotice,
    clearAllNotices,
    accountMenuRef,
    showReportIssue,
    setShowReportIssue,
    accountProfile,
    setAccountProfile,
    authState,
    isCheckingAuth,
    hotelOptions,
    marketOptions,
    roomCategoryOptions,
    customerOptions,
    tourTypeOptions,
    mealBasisOptionsState,
    toursFolderPath,
    toursFolderTree,
    toursFolderExists,
    isLoadingTree,
    isMigrating,
    navCollapsed,
    setNavCollapsed,
    explorerCollapsed,
    setExplorerCollapsed,
    uniqueContractNames,
    availableSupplements,
    manualRates,
    setManualRates,
    editHotelRateId,
    setEditHotelRateId,
    showAccountMenu,
    setShowAccountMenu,
    docxDropdownOpen,
    setDocxDropdownOpen,
    pdfDropdownOpen,
    setPdfDropdownOpen,
    mainRef,
    form,
    resetForm,
    hasChanges,
    fields,
    append,
    remove,
    lineItems,
    dailyRooms,
    refreshVoucherRegister,
    refreshToursFolderTree,
    addNotice,
    handleAuthenticated,
    handleSignOut,
    handleSave,
    handleGenerateDocx,
    handleGeneratePdf,
    handleSendEmail,
    handleVoucherStatusUpdate,
    openVoucherFromSearch,
    handleSelectToursFolder,
    handleMigrateVouchers,
    handleRevealFile,
    handleClearForm,
    setRatesTrigger,
    setActiveTheme,
    activeTheme,
  } = useAppBridge();

  if (isCheckingAuth) {
    return <LoadingScreen themeClass={themeClass} />;
  }

  if (!authState.isAuthenticated) {
    return (
      <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
      <div
        className={`app-shell ${navCollapsed ? "app-shell-nav-collapsed" : "app-shell-nav-expanded"}`}
      >
        <MenuBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          notices={notices}
          onClearNotice={clearNotice}
          onClearAllNotices={clearAllNotices}
          onNavigate={(view) => setActiveView(view as ActiveView)}
          onSignOut={handleSignOut}
          onReportIssue={() => setShowReportIssue(true)}
          isLoading={isCheckingAuth}
        />

        <div className="app-body">
          <Sidebar
            navCollapsed={navCollapsed}
            setNavCollapsed={setNavCollapsed}
            activeView={activeView}
            setActiveView={(view) => setActiveView(view as ActiveView)}
            refreshVoucherRegister={refreshVoucherRegister}
            voucherFilters={voucherFilters}
            showAccountMenu={showAccountMenu}
            setShowAccountMenu={setShowAccountMenu}
            accountProfile={accountProfile}
            handleSignOut={handleSignOut}
            accountMenuRef={accountMenuRef}
          />

          <main ref={mainRef} className="app-main thin-scrollbar">
            <div className={activeView === "entry" ? "block" : "hidden"}>
              <VoucherEntryScreen
                form={form}
                actionState={actionState}
                hasChanges={hasChanges}
                handleClearForm={handleClearForm}
                handleSave={handleSave}
                handleGenerateDocx={handleGenerateDocx}
                handleGeneratePdf={handleGeneratePdf}
                handleSendEmail={handleSendEmail}
                docxDropdownOpen={docxDropdownOpen}
                setDocxDropdownOpen={setDocxDropdownOpen}
                pdfDropdownOpen={pdfDropdownOpen}
                setPdfDropdownOpen={setPdfDropdownOpen}
                tourTypeOptions={tourTypeOptions}
                hotelOptions={hotelOptions}
                marketOptions={marketOptions}
                uniqueContractNames={uniqueContractNames}
                customerOptions={customerOptions}
                roomCategoryOptions={roomCategoryOptions}
                mealBasisOptionsState={mealBasisOptionsState}
                availableSupplements={availableSupplements}
                lineItems={lineItems}
                dailyRooms={dailyRooms}
                fields={fields}
                append={append}
                remove={remove}
                manualRates={manualRates}
                setManualRates={setManualRates}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
                previewPos={previewPos}
                windowSize={windowSize}
                isDraggingPreview={isDraggingPreview}
                startDragPreview={startDragPreview}
              />
            </div>

            {/* Hotel Rate Master Screen (kept alive in DOM) */}
            <div className={activeView === "rate-master" ? "block" : "hidden"}>
              <HotelRateMasterScreen
                initialEditId={editHotelRateId}
                addNotice={addNotice}
                onBack={() => {
                  setEditHotelRateId(undefined);
                  setActiveView("entry");
                }}
                onManageRates={() => setActiveView("manage-rates")}
                onRatesChanged={() => setRatesTrigger((prev) => prev + 1)}
                onClear={() => setEditHotelRateId(undefined)}
              />
            </div>

            {activeView === "dashboard" ? (
              <DashboardScreen
                onNewVoucher={() => {
                  resetForm(
                    withAccountDefaults(defaultVoucher, accountProfile),
                  );
                  handleClearForm();
                  setActiveView("entry");
                }}
                onOpenVoucher={(id: string) =>
                  void openVoucherFromSearch({ id } as VoucherRecord)
                }
                onGoToRateMaster={() => setActiveView("rate-master")}
                onGoToRegister={() => {
                  setActiveView("register");
                  void refreshVoucherRegister(voucherFilters);
                }}
              />
            ) : activeView === "manage-rates" ? (
              <ManageRatesScreen
                onBack={() => setActiveView("rate-master")}
                onEdit={(id) => {
                  setEditHotelRateId(id);
                  setActiveView("rate-master");
                }}
                onRatesChanged={() => setRatesTrigger((prev) => prev + 1)}
                addNotice={addNotice}
              />
            ) : activeView === "settings" ? (
              <SettingsScreen
                activeTheme={activeTheme}
                onThemeChange={setActiveTheme}
                onReferencesChanged={() => setRatesTrigger((prev) => prev + 1)}
                accountProfile={accountProfile}
                onProfileUpdated={setAccountProfile}
                addNotice={addNotice}
              />
            ) : activeView === "profile" ? (
              <ProfileScreen
                accountProfile={accountProfile}
                onProfileUpdated={setAccountProfile}
                addNotice={addNotice}
              />
            ) : activeView === "register" ? (
              <SavedVouchersScreen
                voucherFilters={voucherFilters}
                setVoucherFilters={setVoucherFilters}
                refreshVoucherRegister={refreshVoucherRegister}
                isLoadingRegister={isLoadingRegister}
                voucherRegister={voucherRegister}
                statusUpdatingId={statusUpdatingId}
                handleVoucherStatusUpdate={handleVoucherStatusUpdate}
                openingVoucherId={openingVoucherId}
                openVoucherFromSearch={openVoucherFromSearch}
              />
            ) : null}

            <SearchOverlay
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSearching={isSearching}
              searchResults={searchResults}
              openVoucherFromSearch={openVoucherFromSearch}
            />
          </main>

          <TourExplorerPanel
            toursFolderPath={toursFolderPath}
            toursFolderTree={toursFolderTree}
            toursFolderExists={toursFolderExists}
            documentHistory={documentHistory}
            voucherRevisions={voucherRevisions}
            isLoading={isLoadingTree}
            isMigrating={isMigrating}
            collapsed={explorerCollapsed}
            onToggleCollapse={() => setExplorerCollapsed((prev) => !prev)}
            onSelectFolder={handleSelectToursFolder}
            onRefresh={refreshToursFolderTree}
            onOpenFile={(filePath) => window.meridian?.openDocument(filePath)}
            onOpenDocument={(filePath) =>
              window.meridian?.openDocument(filePath)
            }
            onRevealFile={handleRevealFile}
            onMigrate={handleMigrateVouchers}
          />
          <ReportIssueModal
            isOpen={showReportIssue}
            onClose={() => setShowReportIssue(false)}
          />
        </div>
      </div>
    </div>
  );
}
