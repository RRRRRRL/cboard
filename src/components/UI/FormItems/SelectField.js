import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';

const styles = (theme) => ({
  formControl: {
    width: '100%',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
});

const SelectField = ({
  classes,
  name,
  label,
  value,
  onChange,
  options,
  error,
  helperText,
  required,
  disabled,
  ...props
}) => {
  return (
    <FormControl
      className={classes.formControl}
      error={error}
      required={required}
      disabled={disabled}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        name={name}
        value={value}
        onChange={onChange}
        label={label}
        {...props}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

SelectField.propTypes = {
  classes: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.any.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default withStyles(styles)(SelectField);
