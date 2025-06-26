import React from "react";
import { Button, ButtonProps } from "../ui/button";

interface Props extends ButtonProps {
  dialogid: string;
  command?: string;
}
export const ToggleDialogButton = ({ children, dialogid, ...props }: Props) => {
  return (
    <Button {...props} commandfor={dialogid} command="show-modal">
      {children}
    </Button>
  );
};

export const HideDialogButton = ({ children, dialogid, ...props }: Props) => {
  return (
    <Button {...props} commandfor={dialogid} command="close">
      {children}
    </Button>
  );
};
