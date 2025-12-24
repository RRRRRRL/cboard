import React from 'react';
import PropTypes from 'prop-types';
import { injectIntl, intlShape } from 'react-intl';
import { IconButton as MuiIconButton } from '@material-ui/core';
import ShareIcon from '@material-ui/icons/Share';

import messages from './ProfileTransferButton.messages';

const propTypes = {
  /**
   * @ignore
   */
  intl: intlShape.isRequired,
  /**
   * Callback fired when button is clicked
   */
  onClick: PropTypes.func,
  /**
   * If true, button is disabled
   */
  disabled: PropTypes.bool
};

function ProfileTransferButton(props) {
  const { intl, onClick, disabled, ...other } = props;
  const label = intl.formatMessage(messages.share);

  return (
    <MuiIconButton
      className="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorInherit"
      tabIndex={0}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...other}
    >
      <span className="MuiIconButton-label">
        <ShareIcon className="MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24" aria-hidden="true" />
      </span>
      <span className="MuiTouchRipple-root"></span>
    </MuiIconButton>
  );
}

ProfileTransferButton.propTypes = propTypes;

export default injectIntl(ProfileTransferButton);

