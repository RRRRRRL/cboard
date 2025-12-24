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
import './Intro.css';

const propTypes = {
  history: PropTypes.object.isRequired,
  onClose: PropTypes.func,
  language: PropTypes.object.isRequired
};

function Intro({ history, language }) {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    let markdownPath = '';
    try {
      markdownPath = require(`../../../translations/intro/${language.lang}.md`);
    } catch (err) {
      // Fallback to English if language file is missing
      try {
        markdownPath = require(`../../../translations/intro/en-US.md`);
      } catch (fallbackErr) {
        // If even English is missing, use placeholder
        setMarkdown(
          '# Welcome to Cboard\n\n' +
            'Cboard is a free web application for children and adults with speech and language impairments, facilitating communication with pictures and text-to-speech.\n\n' +
            '## Key Features\n\n' +
            '- **Picture-based Communication**: Use symbols and images to communicate\n' +
            '- **Text-to-Speech**: Hear your messages read aloud\n' +
            '- **Customizable Boards**: Create and personalize communication boards\n' +
            '- **Multi-language Support**: Available in 33+ languages\n' +
            '- **Accessibility Features**: Scanning, eye tracking, and more'
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
            '# Welcome to Cboard\n\n' +
              'Cboard is a free web application for children and adults with speech and language impairments, facilitating communication with pictures and text-to-speech.'
          );
        });
    }
  }, [language.lang]);

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.intro} />}
      onClose={history.goBack}
    >
      <Paper aria-label="intro" className="Intro">
        <FullScreenDialogContent>
          <ReactMarkdown source={markdown} escapeHtml={false} />
        </FullScreenDialogContent>
      </Paper>
    </FullScreenDialog>
  );
}

Intro.propTypes = propTypes;

const mapStateToProps = state => ({
  language: state.language
});

export default connect(mapStateToProps)(Intro);

