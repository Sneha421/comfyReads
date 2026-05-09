type ToastTone = "default" | "error";

type ToastProps = {
  message: string;
  tone?: ToastTone;
  visible: boolean;
};

export default function Toast({
  message,
  tone = "default",
  visible,
}: ToastProps) {
  return (
    <div
      aria-live="polite"
      className={`toast-shell ${visible ? "toast-shell--visible" : ""} ${
        tone === "error" ? "toast-shell--error" : "toast-shell--default"
      }`}
    >
      {message}
    </div>
  );
}
