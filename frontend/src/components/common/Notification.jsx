import SystemPopup from "./SystemPopup";

export default function Notification({ type = "info", message, onClose }) {
  return <SystemPopup tone={type} message={message} onClose={onClose} autoClose={type === "success"} />;
}
