import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import Transfer from './Transfer.component';
import API from '../../../api';
import messages from './Transfer.messages';

export class TransferContainer extends PureComponent {
  static propTypes = {
    profiles: PropTypes.array.isRequired,
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  handleGenerateQR = async profileId => {
    try {
      const result = await API.generateQRCode(profileId, 24);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.qrGenerated)
      );
      return result;
    } catch (error) {
      console.error('Generate QR code error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage(messages.error)
      );
    }
  };

  handleGenerateCloudCode = async profileId => {
    try {
      const result = await API.generateCloudCode(profileId, 168);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.cloudCodeGenerated)
      );
      return result;
    } catch (error) {
      console.error('Generate cloud code error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage(messages.error)
      );
    }
  };

  handleGenerateEmail = async (profileId, email) => {
    try {
      const result = await API.generateEmailTransfer(profileId, email, 168);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.emailSent)
      );
      return result;
    } catch (error) {
      console.error('Generate email transfer error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage(messages.error)
      );
    }
  };

  handleRedeemCode = async code => {
    try {
      // Try cloud code first
      try {
        const result = await API.redeemCloudCode(code);
        this.props.showNotification(
          this.props.intl.formatMessage(messages.profileImported)
        );
        // Reload profiles after import
        window.location.reload();
        return result;
      } catch (cloudError) {
        // If cloud code fails, try QR token
        const result = await API.redeemQRToken(code);
        this.props.showNotification(
          this.props.intl.formatMessage(messages.profileImported)
        );
        // Reload profiles after import
        window.location.reload();
        return result;
      }
    } catch (error) {
      console.error('Redeem code error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage(messages.invalidCode)
      );
    }
  };

  render() {
    const { profiles, history, intl } = this.props;

    return (
      <Transfer
        profiles={profiles}
        onClose={history.goBack}
        onGenerateQR={this.handleGenerateQR}
        onGenerateCloudCode={this.handleGenerateCloudCode}
        onGenerateEmail={this.handleGenerateEmail}
        onRedeemCode={this.handleRedeemCode}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = state => ({
  profiles: state.communicator.communicators || []
});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(TransferContainer));

