import React, { ReactNode, useEffect, createContext } from "react";
import { connect, ConnectedProps } from "react-redux";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { isTest } from "ui/utils/environment";
import { actions } from "ui/actions";
import { ModalType } from "ui/state/app";
import useAuth0 from "ui/utils/useAuth0";

import AppErrors from "./shared/Error";
import LoginModal from "./shared/LoginModal";
import RenameReplayModal from "./shared/Modals/RenameReplayModal";
import * as selectors from "ui/reducers/app";
import { getQuickOpenEnabled } from "devtools/client/debugger/src/selectors";
import { UIState } from "ui/state";
import { Nag, useGetUserInfo } from "ui/hooks/users";

import LoadingScreen from "./shared/LoadingScreen";
import TOSScreen, { LATEST_TOS_VERSION } from "./TOSScreen";
import { ConfirmRenderer } from "./shared/Confirm";
import PrivacyModal from "./shared/PrivacyModal";
import LoomModal from "./shared/LoomModal";
import NewAttachment from "./shared/NewAttachment";
import QuickOpenModal from "devtools/client/debugger/src/components/QuickOpenModal";
import hooks from "ui/hooks";
import { shouldShowNag } from "ui/utils/user";
import { trackEvent } from "ui/utils/telemetry";

const LaunchBrowserModal = React.lazy(() => import("./shared/LaunchBrowserModal"));
const NewWorkspaceModal = React.lazy(() => import("./shared/NewWorkspaceModal"));
const WorkspaceSettingsModal = React.lazy(() => import("./shared/WorkspaceSettingsModal"));
const UserSettingsModal = React.lazy(() => import("./shared/UserSettingsModal"));
const SharingModal = React.lazy(() => import("./shared/SharingModal"));
const OnboardingModal = React.lazy(() => import("./shared/OnboardingModal/index"));
const DownloadReplayPromptModal = React.lazy(
  () => import("./shared/OnboardingModal/DownloadReplayPromptModal")
);
const SourcemapSetupModal = React.lazy(() => import("./shared/Modals/SourcemapSetupModal"));
const SingleInviteModal = React.lazy(() => import("./shared/OnboardingModal/SingleInviteModal"));
const FirstReplayModal = React.lazy(() => import("./shared/FirstReplayModal"));

function AppModal({ hideModal, modal }: { hideModal: () => void; modal: ModalType }) {
  const loadingFinished = useAppSelector(selectors.getLoadingFinished);

  // Dismiss modal if the "Escape" key is pressed.
  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideModal();
      }
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [hideModal, loadingFinished]);

  if (!loadingFinished) {
    return null;
  }

  switch (modal) {
    case "sharing": {
      return <SharingModal />;
    }
    case "login": {
      return <LoginModal />;
    }
    case "settings": {
      return <UserSettingsModal />;
    }
    case "new-workspace": {
      return <NewWorkspaceModal />;
    }
    case "workspace-settings": {
      return <WorkspaceSettingsModal />;
    }
    case "onboarding": {
      return <OnboardingModal />;
    }
    case "single-invite": {
      return <SingleInviteModal />;
    }
    case "browser-launch": {
      return <LaunchBrowserModal />;
    }
    case "first-replay": {
      return <FirstReplayModal />;
    }
    case "download-replay": {
      return <DownloadReplayPromptModal />;
    }
    case "privacy": {
      return <PrivacyModal />;
    }
    case "loom": {
      return <LoomModal />;
    }
    case "attachment": {
      return <NewAttachment />;
    }
    case "sourcemap-setup": {
      return <SourcemapSetupModal />;
    }
    case "rename-replay": {
      return <RenameReplayModal />;
    }
    default: {
      return null;
    }
  }
}

function App({ children, hideModal, modal, quickOpenEnabled }: AppProps) {
  const auth = useAuth0();
  const dismissNag = hooks.useDismissNag();
  const userInfo = useGetUserInfo();
  const theme = useAppSelector(selectors.getTheme);

  useEffect(() => {
    if (userInfo.nags && shouldShowNag(userInfo.nags, Nag.FIRST_LOG_IN)) {
      trackEvent("login.first_log_in");
      dismissNag(Nag.FIRST_LOG_IN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo.nags]);

  useEffect(() => {
    // Stop space bar from being used as a universal "scroll down" operator
    // We have a big play/pause interface, so space makes way more sense for that.

    const stopCodeMirrorScroll = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        return;
      }

      if (
        e.target === document.body ||
        (e.target?.hasOwnProperty("classList") &&
          (e.target as Element).classList.contains(".CodeMirror-scroll"))
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", stopCodeMirrorScroll);
    return () => window.removeEventListener("keydown", stopCodeMirrorScroll);
  }, []);

  useEffect(() => {
    document.body.parentElement!.className = `theme-${theme}`;
  }, [theme]);

  if (auth.isLoading || userInfo.loading) {
    return <LoadingScreen fallbackMessage="Authenticating..." />;
  }

  if (
    !isTest() &&
    auth.isAuthenticated &&
    userInfo.acceptedTOSVersion &&
    userInfo.acceptedTOSVersion !== LATEST_TOS_VERSION
  ) {
    return <TOSScreen />;
  }

  return (
    <div id="app-container">
      {children}
      {modal ? (
        <React.Suspense>
          <AppModal hideModal={hideModal} modal={modal} />
        </React.Suspense>
      ) : null}
      {quickOpenEnabled === true && <QuickOpenModal />}
      <ConfirmRenderer />
      <AppErrors />
    </div>
  );
}

const connector = connect(
  (state: UIState) => ({
    modal: selectors.getModal(state),

    // Only read quick open state if it exists, to ensure safe loads
    quickOpenEnabled: !!state.quickOpen && getQuickOpenEnabled(state),
  }),
  {
    hideModal: actions.hideModal,
  }
);
export type AppProps = ConnectedProps<typeof connector> & { children?: ReactNode };

export default connector(App);
