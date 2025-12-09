import React, { useEffect, useState, useRef } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Formik } from 'formik';
import classNames from 'classnames';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import { TextField } from '../../UI/FormItems';
import LoadingIcon from '../../UI/LoadingIcon';
import validationSchema from './validationSchema';
import { login } from './Login.actions';
import messages from './Login.messages';
import './Login.css';
import PasswordTextField from '../../UI/FormItems/PasswordTextField';

const initialValues = {
  email: '',
  password: ''
};

export function Login({
  intl,
  isDialogOpen,
  onClose,
  onResetPasswordClick,
  dialogWithKeyboardStyle = {},
  login
}) {
  const [isLogging, setIsLogging] = useState(false);
  const [loginStatus, setLoginStatus] = useState({});
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup: cancel any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(
    () => {
      if (isDialogOpen) {
        setLoginStatus({});
        setIsLogging(false);
      }
    },
    [isDialogOpen]
  );

  const handleSubmit = async values => {
    setIsLogging(true);
    setLoginStatus({});
    try {
      await login(values);
      // Login successful - close dialog
      // The app will automatically recognize the user as logged in via Redux state
      if (isMountedRef.current) {
        setIsLogging(false);
        setLoginStatus({ success: true, message: 'Login successful!' });
        // Close dialog after a short delay to show success message
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && onClose) {
            onClose();
          }
          timeoutRef.current = null;
        }, 500);
      }
    } catch (loginStatus) {
      if (isMountedRef.current) {
        setLoginStatus(loginStatus);
        setIsLogging(false);
      }
    }
  };

  const isButtonDisabled = isLogging || !!loginStatus.success;

  const { dialogStyle, dialogContentStyle } = dialogWithKeyboardStyle ?? {};

  return (
    <Dialog
      open={isDialogOpen}
      onClose={onClose}
      aria-labelledby="login"
      style={dialogStyle}
    >
      <DialogTitle id="login">
        <FormattedMessage {...messages.login} />
      </DialogTitle>
      <DialogContent style={dialogContentStyle}>
        <div
          className={classNames('Login__status', {
            'Login__status--error': !loginStatus.success,
            'Login__status--success': loginStatus.success
          })}
        >
          <Typography color="inherit">{loginStatus.message}</Typography>
        </div>
        <Formik
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validationSchema={validationSchema}
        >
          {({ errors, handleChange, handleSubmit }) => (
            <form className="Login__form" onSubmit={handleSubmit}>
              <TextField
                error={errors.email}
                label={intl.formatMessage(messages.email)}
                name="email"
                onChange={handleChange}
              />
              <PasswordTextField
                error={errors.password}
                label={intl.formatMessage(messages.password)}
                name="password"
                onChange={handleChange}
              />
              <DialogActions>
                <Button
                  color="primary"
                  disabled={isButtonDisabled}
                  onClick={onClose}
                >
                  <FormattedMessage {...messages.cancel} />
                </Button>
                <Button
                  type="submit"
                  disabled={isButtonDisabled}
                  variant="contained"
                  color="primary"
                >
                  {isLogging && <LoadingIcon />}
                  <FormattedMessage {...messages.login} />
                </Button>
              </DialogActions>
            </form>
          )}
        </Formik>
        <Button
          size="small"
          color="primary"
          disabled={isButtonDisabled}
          onClick={onResetPasswordClick}
        >
          <FormattedMessage {...messages.forgotPassword} />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const mapDispatchToProps = {
  login
};

export default connect(
  null,
  mapDispatchToProps
)(injectIntl(Login));
