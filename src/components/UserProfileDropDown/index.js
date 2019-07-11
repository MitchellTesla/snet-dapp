import React, { useRef } from "react";
import { withStyles } from "@material-ui/styles";

import UserProfileHeader from "./UserProfileHeader";
import UserMenu from "./UserMenu";
import { useStyles } from "./styles";
import useOutsideClick from "../Hooks/useOutsideClick";

const UserProfileDropDown = ({ classes, handleClick }) => {
  const wrapperRef = useRef(null);
  useOutsideClick(wrapperRef, handleClick);

  return (
    <div ref={wrapperRef}>
      <div className={classes.UserProfilePopUpContainer}>
        <UserProfileHeader userName="waythingswork" remainingCredits="120" usedCredits="30" />
        <UserMenu />
      </div>
    </div>
  );
};

export default withStyles(useStyles)(UserProfileDropDown);
