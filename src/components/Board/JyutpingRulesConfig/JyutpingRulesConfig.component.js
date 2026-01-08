import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { injectIntl, FormattedMessage } from 'react-intl';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import CircularProgress from '@material-ui/core/CircularProgress';
import API from '../../../api/api';
import messages from './JyutpingRulesConfig.messages';
import './JyutpingRulesConfig.css';

function JyutpingRulesConfig({
  open,
  onClose,
  userId,
  profileId,
  intl
}) {
  const [loading, setLoading] = useState(false);
  const [matchingRules, setMatchingRules] = useState({
    frequency_threshold: 50,
    allow_exact_match: true,
    allow_substring_match: true,
    allow_single_char_match: true,
    require_ai_correction: false,
    ai_confidence_threshold: 0.50,
    enabled: true,
    // Phonological adaptation rules
    merge_n_ng_finals: false,
    allow_coda_simplification: false,
    ignore_tones: false,
    allow_fuzzy_tones: false,
    fuzzy_tone_pairs: null,
    allow_ng_zero_confusion: false,
    allow_n_l_confusion: false
  });
  const [exceptionRules, setExceptionRules] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (open && userId) {
      loadRules(isMounted);
    }

    return () => {
      isMounted = false;
    };
  }, [open, userId, profileId]);

  const loadRules = async (isMounted) => {
    setLoading(true);
    try {
      // Ensure userId and profileId are numbers
      const userIdNum = userId ? parseInt(userId, 10) : null;
      const profileIdNum = profileId ? parseInt(profileId, 10) : null;

      if (!userIdNum) {
        if (isMounted) setLoading(false);
        return;
      }

      // Load matching rules
      const matchingResponse = await API.getJyutpingMatchingRules(userIdNum, profileIdNum);
      if (isMounted && matchingResponse && matchingResponse.success) {
        // Merge with defaults to ensure all fields are present
        setMatchingRules(prev => ({
          ...prev,
          ...matchingResponse.data,
          // Ensure phonological rules have defaults if not present
          merge_n_ng_finals: matchingResponse.data.merge_n_ng_finals ?? false,
          allow_coda_simplification: matchingResponse.data.allow_coda_simplification ?? false,
          ignore_tones: matchingResponse.data.ignore_tones ?? false,
          allow_fuzzy_tones: matchingResponse.data.allow_fuzzy_tones ?? false,
          fuzzy_tone_pairs: matchingResponse.data.fuzzy_tone_pairs ?? null,
          allow_ng_zero_confusion: matchingResponse.data.allow_ng_zero_confusion ?? false,
          allow_n_l_confusion: matchingResponse.data.allow_n_l_confusion ?? false
        }));
      }

      // Load exception rules
      const exceptionResponse = await API.getJyutpingExceptionRules(userIdNum, profileIdNum);
      if (isMounted && exceptionResponse && exceptionResponse.success) {
        setExceptionRules(exceptionResponse.data.rules || []);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      

      // Ensure userId and profileId are numbers
      const userIdNum = userId ? parseInt(userId, 10) : null;
      const profileIdNum = profileId ? parseInt(profileId, 10) : null;

      

      if (!userIdNum) {
        alert(intl.formatMessage(messages.saveError));
        setSaving(false);
        return;
      }

      

      // Save matching rules
      const matchingResult = await API.updateJyutpingMatchingRules(userIdNum, matchingRules, profileIdNum);

      // Save exception rules
      const rulesToSave = exceptionRules.map(rule => ({
        rule_id: rule.id,
        enabled: rule.enabled
      }));
      const exceptionResult = await API.updateJyutpingExceptionRules(userIdNum, rulesToSave, profileIdNum);

      
      onClose();
    } catch (error) {
      alert(intl.formatMessage(messages.saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleMatchingRuleChange = (field, value) => {
    setMatchingRules(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExceptionRuleToggle = (ruleId) => {
    setExceptionRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <FormattedMessage {...messages.title} />
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <div className="JyutpingRulesConfig">
            {/* Matching Rules Section */}
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.matchingRules} />
            </Typography>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.enabled}
                    onChange={(e) => handleMatchingRuleChange('enabled', e.target.checked)}
                  />
                }
                label={intl.formatMessage(messages.enableMatchingRules)}
              />
            </FormGroup>

            <TextField
              fullWidth
              type="number"
              label={intl.formatMessage(messages.frequencyThreshold)}
              value={matchingRules.frequency_threshold}
              onChange={(e) => handleMatchingRuleChange('frequency_threshold', parseInt(e.target.value) || 50)}
              margin="normal"
              helperText={intl.formatMessage(messages.frequencyThresholdHelp)}
            />

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_exact_match}
                    onChange={(e) => handleMatchingRuleChange('allow_exact_match', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowExactMatch)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_substring_match}
                    onChange={(e) => handleMatchingRuleChange('allow_substring_match', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowSubstringMatch)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_single_char_match}
                    onChange={(e) => handleMatchingRuleChange('allow_single_char_match', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowSingleCharMatch)}
              />
            </FormGroup>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.require_ai_correction}
                    onChange={(e) => handleMatchingRuleChange('require_ai_correction', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.requireAICorrection)}
              />
            </FormGroup>

            <TextField
              fullWidth
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              label={intl.formatMessage(messages.aiConfidenceThreshold)}
              value={matchingRules.ai_confidence_threshold}
              onChange={(e) => handleMatchingRuleChange('ai_confidence_threshold', parseFloat(e.target.value) || 0.5)}
              margin="normal"
              disabled={!matchingRules.enabled}
              helperText={intl.formatMessage(messages.aiConfidenceThresholdHelp)}
            />

            <Divider style={{ margin: '20px 0' }} />

            {/* Phonological Adaptation Rules Section */}
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.phonologicalRules} />
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              <FormattedMessage {...messages.phonologicalRulesHelp} />
            </Typography>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.merge_n_ng_finals}
                    onChange={(e) => handleMatchingRuleChange('merge_n_ng_finals', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.mergeNngFinals)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_coda_simplification}
                    onChange={(e) => handleMatchingRuleChange('allow_coda_simplification', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowCodaSimplification)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.ignore_tones}
                    onChange={(e) => handleMatchingRuleChange('ignore_tones', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.ignoreTones)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_fuzzy_tones}
                    onChange={(e) => handleMatchingRuleChange('allow_fuzzy_tones', e.target.checked)}
                    disabled={!matchingRules.enabled || matchingRules.ignore_tones}
                  />
                }
                label={intl.formatMessage(messages.allowFuzzyTones)}
              />
              {matchingRules.allow_fuzzy_tones && !matchingRules.ignore_tones && (
                <TextField
                  fullWidth
                  label={intl.formatMessage(messages.fuzzyTonePairs)}
                  value={matchingRules.fuzzy_tone_pairs || ''}
                  onChange={(e) => handleMatchingRuleChange('fuzzy_tone_pairs', e.target.value)}
                  margin="normal"
                  placeholder="2,5|3,6"
                  helperText={intl.formatMessage(messages.fuzzyTonePairsHelp)}
                  disabled={!matchingRules.enabled}
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_ng_zero_confusion}
                    onChange={(e) => handleMatchingRuleChange('allow_ng_zero_confusion', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowNgZeroConfusion)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={matchingRules.allow_n_l_confusion}
                    onChange={(e) => handleMatchingRuleChange('allow_n_l_confusion', e.target.checked)}
                    disabled={!matchingRules.enabled}
                  />
                }
                label={intl.formatMessage(messages.allowNLConfusion)}
              />
            </FormGroup>

            <Divider style={{ margin: '20px 0' }} />

            {/* Exception Rules Section */}
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.exceptionRules} />
            </Typography>

            <Typography variant="body2" color="textSecondary" paragraph>
              <FormattedMessage {...messages.exceptionRulesHelp} />
            </Typography>

            <FormGroup>
              {exceptionRules.map(rule => (
                <FormControlLabel
                  key={rule.id}
                  control={
                    <Switch
                      checked={rule.enabled}
                      onChange={() => handleExceptionRuleToggle(rule.id)}
                    />
                  }
                  label={
                    <div>
                      <Typography variant="body1">{rule.rule_name}</Typography>
                      {rule.rule_description && (
                        <Typography variant="caption" color="textSecondary">
                          {rule.rule_description}
                        </Typography>
                      )}
                    </div>
                  }
                />
              ))}
            </FormGroup>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          <FormattedMessage {...messages.cancel} />
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={saving || loading}>
          {saving ? <CircularProgress size={20} /> : <FormattedMessage {...messages.save} />}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

JyutpingRulesConfig.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  profileId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  intl: PropTypes.object.isRequired
};

JyutpingRulesConfig.defaultProps = {
  open: false
};

export default injectIntl(JyutpingRulesConfig);
