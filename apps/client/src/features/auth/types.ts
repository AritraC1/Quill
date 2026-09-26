// types/interfaces that are specific to authentication

export type View = "joinOptions" | "joinEmail" | "signinOptions" | "signinEmail";

export interface AuthPopupFormProps {
  /** Controls whether the modal is rendered/visible. */
  isOpen: boolean;
  /** Called when the user closes the modal (backdrop click, Esc, close icon). */
  onClose: () => void;
  /** Which panel to open on first render. Defaults to the sign-up options. */
  initialView?: View;
}