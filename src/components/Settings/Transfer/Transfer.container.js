import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import { addBoards } from '../../Board/Board.actions';
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
      const response = await API.generateQRCode(profileId, 24);
      // Backend returns { data: { token: '...', expires_at: '...' } } or { data: { success: false, message: '...' } }
      const result = response?.data || response;
      
      if (result?.token) {
        this.props.showNotification(
          this.props.intl.formatMessage(messages.qrGenerated),
          'success'
        );
        return result;
      } else {
        throw new Error(result?.message || this.props.intl.formatMessage(messages.error));
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      const errorMessage = error.response?.data?.data?.message || 
                          error.response?.data?.message || 
                          error.message ||
                          this.props.intl.formatMessage(messages.error);
      this.props.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
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
        const response = await API.redeemCloudCode(code);
        const result = response?.data || response;
        
        if (result?.success !== false) {
          this.props.showNotification(
            this.props.intl.formatMessage(messages.profileImported),
            'success'
          );
          // Refresh boards list after import instead of reloading page
          await this.refreshBoardsList();
          return result;
        } else {
          throw new Error(result?.message || 'Cloud code redemption failed');
        }
      } catch (cloudError) {
        // If cloud code fails, try QR token
        try {
          const response = await API.redeemQRToken(code);
          const result = response?.data || response;
          
          if (result?.success !== false) {
            this.props.showNotification(
              this.props.intl.formatMessage(messages.profileImported),
              'success'
            );
            // Refresh boards list after import instead of reloading page
            await this.refreshBoardsList();
            return result;
          } else {
            throw new Error(result?.message || 'QR token redemption failed');
          }
        } catch (qrError) {
          // Both failed, throw the original cloud error
          throw cloudError;
        }
      }
    } catch (error) {
      console.error('Redeem code error:', error);
      const errorMessage = error.response?.data?.data?.message || 
                          error.response?.data?.message || 
                          error.message ||
                          this.props.intl.formatMessage(messages.invalidCode);
      this.props.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  refreshBoardsList = async () => {
    try {
      // Fetch latest boards from API
      const response = await API.getMyBoards({ page: 1, limit: 1000 });
      if (response && response.data && Array.isArray(response.data)) {
        // Update Redux state with latest boards
        this.props.addBoards(response.data, true); // true = isCompleteRefresh
        console.log('[Transfer] Refreshed boards list after import:', {
          boardsCount: response.data.length
        });
      }
    } catch (error) {
      console.error('[Transfer] Failed to refresh boards list:', error);
      // Fallback: reload page if refresh fails
      window.location.reload();
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
  showNotification,
  addBoards
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(TransferContainer));

