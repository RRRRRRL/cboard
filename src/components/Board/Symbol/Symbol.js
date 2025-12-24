import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { isCordova } from '../../../cordova-util';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import messages from '../Board.messages';

import { LABEL_POSITION_BELOW } from '../../Settings/Display/Display.constants';
import './Symbol.css';
import { Typography } from '@material-ui/core';
import { getArasaacDB } from '../../../idb/arasaac/arasaacdb';
import { API_URL } from '../../../constants';

const propTypes = {
  /**
   * Image to display
   */
  image: PropTypes.string,
  /**
   * Label to display
   */
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  labelpos: PropTypes.string,
  type: PropTypes.string,
  onWrite: PropTypes.func,
  intl: PropTypes.object
};

function formatSrc(src) {
  if (!src) return src;
  
  // Handle Cordova paths
  if (isCordova() && src?.startsWith('/')) {
    return `.${src}`;
  }
  
  if (typeof src !== 'string') {
    return src;
  }
  
  // Skip data URIs and blob URLs
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  
  // Get base URL from API_URL (which uses REACT_APP_DEV_API_URL from .env)
  let baseUrl;
  try {
    if (API_URL) {
      // Check if API_URL is a relative path (starts with /)
      if (API_URL.startsWith('/')) {
        // Relative path - use current origin
        baseUrl = window.location.origin;
      } else {
        // Absolute URL - extract base URL
        const apiUrlObj = new URL(API_URL);
        baseUrl = `${apiUrlObj.protocol}//${apiUrlObj.host}`;
      }
    } else {
      baseUrl = window.location.origin;
    }
  } catch (e) {
    console.warn('Failed to extract base URL from API_URL:', e);
    baseUrl = window.location.origin;
  }
  
  // Handle full URLs (http:// or https://) - check if it's an upload path from our backend
  if (src.startsWith('http://') || src.startsWith('https://')) {
    // Check if it's an upload path from our backend (contains /uploads/ or /api/uploads/)
    if (src.includes('/uploads/') || src.includes('/api/uploads/')) {
      try {
        const urlObj = new URL(src);
        let path = urlObj.pathname;
        
        // Ensure /api/uploads/ prefix is present (add if missing)
        if (path.startsWith('/uploads/') && !path.startsWith('/api/uploads/')) {
          path = '/api' + path;
        }
        
        // Reconstruct with current base URL
        return `${baseUrl}${path}`;
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const match = src.match(/(\/uploads\/.*)$/);
        if (match) {
          let path = match[1];
          // Ensure /api/uploads/ prefix
          if (!path.startsWith('/api/uploads/')) {
            path = '/api' + path;
          }
          return `${baseUrl}${path}`;
        }
        // If no match, return as-is (might be external URL)
        return src;
      }
    }
    // For other external URLs, return as-is
    return src;
  }
  
  // Handle relative paths (uploads/... or api/uploads/...)
  if (src.startsWith('uploads/') || src.startsWith('api/uploads/')) {
    try {
      // Ensure 'api/' prefix is present
      let imagePath = src;
      if (imagePath.startsWith('uploads/') && !imagePath.startsWith('api/uploads/')) {
        imagePath = 'api/' + imagePath;
      }
      
      // Construct URL: baseUrl + /api/uploads/...
      return `${baseUrl}/${imagePath}`;
    } catch (e) {
      console.warn('Failed to convert relative upload path to absolute URL:', e);
    }
  }
  
  return src;
}

function Symbol(props) {
  const {
    className,
    label,
    labelpos,
    keyPath,
    type,
    onWrite,
    intl,
    image,
    ...other
  } = props;

  const [src, setSrc] = useState(image ? formatSrc(image) : '');
  const objectUrlRef = useRef(null);

  const fetchArasaacImagefromIndexedDB = useCallback(async id => {
    if (!id) return null;

    try {
      const arasaacDB = getArasaacDB();
      return await arasaacDB.getImageById(id);
    } catch (error) {
      console.error('Failed to fetch Arasaac image from Indexed DB:', error);
      return null;
    }
  }, []);

  useEffect(
    () => {
      let cancelled = false;

      async function getSrc() {
        const imageFromIndexedDb = await fetchArasaacImagefromIndexedDB(
          keyPath
        );

        if (cancelled) return;

        if (imageFromIndexedDb) {
          const blob = new Blob([imageFromIndexedDb.data], {
            type: imageFromIndexedDb.type
          });
          const url = URL.createObjectURL(blob);
          setSrc(url);

          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          objectUrlRef.current = url;
          return;
        }

        if (image) {
          setSrc(formatSrc(image));
          return;
        }

        setSrc('');
      }
      getSrc();

      return () => {
        cancelled = true;
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };
    },
    [fetchArasaacImagefromIndexedDB, image, keyPath]
  );

  const symbolClassName = classNames('Symbol', className);

  const handleKeyPress = event => {
    if (event.key === 'Enter') {
      event.preventDefault(); //prevent new line in next textArea
      return;
    }
  };

  return (
    <div className={symbolClassName} image={src} {...other}>
      {props.type === 'live' && (
        <OutlinedInput
          id="outlined-live-input"
          margin="none"
          color="primary"
          variant="filled"
          placeholder={intl.formatMessage(messages.writeAndSay)}
          autoFocus={true}
          multiline
          rows={5}
          value={label}
          onChange={onWrite}
          fullWidth={true}
          onKeyPress={handleKeyPress}
          style={{
            padding: '0.5em 0.8em 0.5em 0.8em',
            height: '100%'
          }}
          className={'liveInput'}
        />
      )}
      {props.type !== 'live' &&
        props.labelpos === 'Above' &&
        props.labelpos !== 'Hidden' && (
          <Typography className="Symbol__label">{label}</Typography>
        )}

      <div className="Symbol__image-container">
        {src && <img className="Symbol__image" src={src} alt="" />}
      </div>

      {props.type !== 'live' &&
        props.labelpos === 'Below' &&
        props.labelpos !== 'Hidden' && (
          <Typography className="Symbol__label">{label}</Typography>
        )}
    </div>
  );
}
Symbol.propTypes = propTypes;
Symbol.defaultProps = {
  labelpos: LABEL_POSITION_BELOW
};

export default Symbol;
