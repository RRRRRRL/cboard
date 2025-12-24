import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import OCRTranslator from './OCRTranslator.component';
import API from '../../../api';

export class OCRTranslatorContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    ocrResult: null,
    translationHistory: [],
    loading: false
  };

  handleRecognizeImage = async (imageData) => {
    this.setState({ loading: true });
    try {
      const result = await API.recognizeImage(imageData);
      this.setState({ ocrResult: result, loading: false });
      return result;
    } catch (error) {
      // Suppress error logging for expected network errors (frontend will use client-side OCR)
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('OCR recognize error:', error);
      }
      this.setState({ loading: false });
      throw error;
    }
  };

  handleConvertToJyutping = async (text) => {
    this.setState({ loading: true });
    try {
      const result = await API.convertToJyutping(text);
      this.setState({ loading: false });
      return result;
    } catch (error) {
      console.error('Convert to Jyutping error:', error);
      this.setState({ loading: false });
      throw error;
    }
  };

  handleGetHistory = async () => {
    this.setState({ loading: true });
    try {
      const result = await API.getOCRHistory(20, 0);
      this.setState({ translationHistory: result.history || [], loading: false });
    } catch (error) {
      // Suppress error logging for expected network errors
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('Get OCR history error:', error);
      }
      this.setState({ loading: false });
    }
  };

  handleAnnotateImage = async (imageData, imageUrl, annotations) => {
    this.setState({ loading: true });
    try {
      const result = await API.annotateImage(imageData, imageUrl, annotations);
      this.setState({ loading: false });
      return result;
    } catch (error) {
      console.error('Annotate image error:', error);
      this.setState({ loading: false });
      throw error;
    }
  };

  handleDeleteHistory = async (historyId) => {
    try {
      await API.deleteOCRHistory(historyId);
      this.props.showNotification(
        this.props.intl.formatMessage({ 
          id: 'cboard.components.Settings.OCRTranslator.deleted', 
          defaultMessage: 'History item deleted' 
        })
      );
      this.handleGetHistory();
    } catch (error) {
      // Suppress error logging for expected network errors
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('Delete OCR history error:', error);
      }
    }
  };

  render() {
    const { history, intl } = this.props;
    const { ocrResult, translationHistory, loading } = this.state;

    return (
      <OCRTranslator
        onClose={history.goBack}
        loading={loading}
        ocrResult={ocrResult}
        translationHistory={translationHistory}
        onRecognizeImage={this.handleRecognizeImage}
        onConvertToJyutping={this.handleConvertToJyutping}
        onAnnotateImage={this.handleAnnotateImage}
        onGetHistory={this.handleGetHistory}
        onDeleteHistory={this.handleDeleteHistory}
        intl={intl}
      />
    );
  }
}

const mapDispatchToProps = {
  showNotification
};

export default connect(
  null,
  mapDispatchToProps
)(injectIntl(OCRTranslatorContainer));

