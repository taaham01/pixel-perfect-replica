import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Site-styled toast messages: card look with a coloured accent bar per message type. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-sm !border !border-border !border-l-4 !border-l-champagne !bg-card !text-foreground !shadow-lift !px-4 !py-3.5 !gap-3 font-sans",
          title: "!text-sm !font-semibold !leading-snug",
          description: "!text-muted-foreground !text-sm",
          success: "!border-l-emerald-600 [&_[data-icon]]:!text-emerald-600",
          error: "!border-l-crimson [&_[data-icon]]:!text-crimson",
          warning: "!border-l-amber-500 [&_[data-icon]]:!text-amber-500",
          info: "!border-l-champagne [&_[data-icon]]:!text-champagne",
          closeButton: "!bg-card !border-border !text-muted-foreground hover:!text-foreground",
          actionButton: "!bg-crimson !text-primary-foreground !rounded-sm",
          cancelButton: "!bg-secondary !text-muted-foreground !rounded-sm",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
