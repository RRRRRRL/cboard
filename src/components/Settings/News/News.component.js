import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import ReactMarkdown from 'react-markdown';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';

import FullScreenDialog, {
  FullScreenDialogContent
} from '../../UI/FullScreenDialog';
import { isCordova } from '../../../cordova-util';
import messages from '../Settings.messages';
import './News.css';

const propTypes = {
  history: PropTypes.object.isRequired,
  onClose: PropTypes.func,
  language: PropTypes.object.isRequired
};

function News({ history, language }) {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    let markdownPath = '';
    try {
      markdownPath = require(`../../../translations/news/${language.lang}.md`);
    } catch (err) {
      // Fallback to English if language file is missing
      try {
        markdownPath = require(`../../../translations/news/en-US.md`);
      } catch (fallbackErr) {
        // If even English is missing, use placeholder
        setMarkdown(
          '# News & Updates\n\n' +
            '- Cboard enhancements build in-progress.\n' +
            '- Eye-tracking, Jyutping games, and profile transfer features are under active development.'
        );
        return;
      }
    }

    if (isCordova()) {
      const req = new XMLHttpRequest();
      req.onload = () => {
        const text = req.responseText;
        setMarkdown(text);
      };
      req.open('GET', markdownPath);
      req.send();
    } else {
      fetch(markdownPath)
        .then(response => response.text())
        .then(text => {
          setMarkdown(text);
        })
        .catch(() => {
          setMarkdown(
            '# News & Updates\n\n' +
              '- Cboard enhancements build in-progress.\n' +
              '- Eye-tracking, Jyutping games, and profile transfer features are under active development.'
          );
        });
    }
  }, [language.lang]);

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.news} />}
      onClose={history.goBack}
    >
      <Paper aria-label="news-updates" className="News">
        <FullScreenDialogContent>
          <ReactMarkdown source={markdown} escapeHtml={false} />
        </FullScreenDialogContent>
      </Paper>
    </FullScreenDialog>
  );
}

News.propTypes = propTypes;

const mapStateToProps = state => ({
  language: state.language
});

export default connect(mapStateToProps)(News);


