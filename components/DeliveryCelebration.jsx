import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../utils/helpers';

export default function DeliveryCelebration({ order, onOpenReceipt }) {
  const nav = useNavigate();
  const { user, toast } = useApp() || {};
  const [sendingEmail, setSendingEmail] = useState(false);
  const [rating, setRating] = useState(order?.rating || 5);
  const [feedbackText, setFeedbackText] = useState(order?.feedback || '');
  const [isEditing, setIsEditing] = useState(!order?.rating);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState(
    order?.rating ? { rating: order.rating, feedback: order.feedback || '', feedbackAt: order.feedbackAt } : null
  );

  if (!order || order.status !== 'Delivered') return null;

  const isAgent = user?.role === 'agent';
  const isCustomerOrRecipient = !isAgent; // Customer, user or consignment recipient

  const handleSendDeliveredEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await api.sendDeliveredEmail(order.id);
      if (res?.ok) {
        toast(`🎉 Celebration & Thank You email sent to ${order.userEmail || 'registered email'}!`, 'success');
      } else {
        toast(res?.message || 'Failed to send confirmation email', 'error');
      }
    } catch (err) {
      toast(err?.response?.data?.message || err?.message || 'Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e?.preventDefault();
    if (isAgent) {
      toast('Delivery agents cannot submit feedback. Only customers can review their orders.', 'error');
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      toast('Please select a star rating between 1 and 5', 'error');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const res = await api.submitFeedback(order.id, {
        rating: Number(rating),
        feedback: feedbackText.trim(),
      });
      if (res?.ok) {
        setSubmittedFeedback({
          rating: Number(rating),
          feedback: feedbackText.trim(),
          feedbackAt: new Date(),
        });
        setIsEditing(false);
        toast('🎉 Thank you! Your delivery feedback has been submitted successfully.', 'success');
      } else {
        toast(res?.message || 'Could not submit feedback', 'error');
      }
    } catch (err) {
      toast(err?.response?.data?.message || err?.message || 'Failed to save feedback', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const deliveryHistory = (order.history || []).slice().reverse().find((h) => h.status === 'Delivered');
  const deliveredTime = deliveryHistory ? fmtDate(deliveryHistory.at) : fmtDate(order.updatedAt || new Date());

  return (
    <div className="deliv-celebration-card">
      {/* Animated Confetti Particles Overlay */}
      <div className="deliv-confetti-wrap" aria-hidden="true">
        <span className="confetti c1"></span>
        <span className="confetti c2"></span>
        <span className="confetti c3"></span>
        <span className="confetti c4"></span>
        <span className="confetti c5"></span>
        <span className="confetti c6"></span>
        <span className="confetti c7"></span>
        <span className="confetti c8"></span>
        <span className="confetti c9"></span>
        <span className="confetti c10"></span>
      </div>

      <div className="deliv-celebration-inner">
        {/* Animated Checkmark Badge */}
        <div className="deliv-badge-col">
          <div className="deliv-anim-circle">
            <svg className="deliv-check-svg" viewBox="0 0 52 52">
              <circle className="deliv-check-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="deliv-check-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
          <span className="deliv-pill-tag">PACKAGE DELIVERED</span>
        </div>

        {/* Text & Congratulations */}
        <div className="deliv-msg-col">
          <h2 className="deliv-title">
            Order #{order.id} Delivered Successfully!
          </h2>
          <p className="deliv-sub">
            Thank you for choosing <strong>Trackora</strong>! Your parcel was safely handed over at your destination.
          </p>

          <div className="deliv-info-chips">
            <span className="deliv-chip">
              🕒 <strong>Delivered On:</strong> {deliveredTime}
            </span>
            <span className="deliv-chip">
              📍 <strong>Drop:</strong> {order.drop?.address ? order.drop.address.split(',')[0] : 'Destination'}
            </span>
            {order.agentName && (
              <span className="deliv-chip">
                🛵 <strong>Courier:</strong> {order.agentName}
              </span>
            )}
            <span className="deliv-chip ok">
              ✓ <strong>Paid:</strong> ₹{order.totalPayable || order.deliveryFee || 40}
            </span>
          </div>

          {/* CUSTOMER VS AGENT FEEDBACK HANDLING: Agent cannot rate; Customer submits feedback */}
          {isAgent ? (
            /* AGENT VIEW: Read-only display of customer feedback */
            <div className="deliv-agent-view-box">
              <div className="deliv-agent-view-header">
                <span>⭐ Customer Delivery Feedback:</span>
              </div>
              {order.rating || submittedFeedback?.rating ? (
                <div className="deliv-agent-feedback-content">
                  <span className="deliv-agent-stars">
                    {'★'.repeat(submittedFeedback?.rating || order.rating)}
                    {'☆'.repeat(5 - (submittedFeedback?.rating || order.rating))}
                  </span>
                  <span className="deliv-agent-score">
                    ({submittedFeedback?.rating || order.rating}/5 Stars)
                  </span>
                  {(submittedFeedback?.feedback || order.feedback) && (
                    <p className="deliv-agent-quote">
                      "{submittedFeedback?.feedback || order.feedback}"
                    </p>
                  )}
                </div>
              ) : (
                <p className="deliv-agent-pending-txt">
                  ⏳ Awaiting customer review. Only the customer can submit delivery rating & feedback.
                </p>
              )}
            </div>
          ) : (
            /* CUSTOMER / USER VIEW: Interactive Uncompacted Feedback Module */
            <div className="deliv-customer-feedback-box">
              {submittedFeedback && !isEditing ? (
                /* Already Submitted View */
                <div className="deliv-feedback-success-state">
                  <div className="deliv-feedback-success-head">
                    <div className="deliv-success-stars">
                      <span className="deliv-stars-filled">
                        {'★'.repeat(submittedFeedback.rating)}
                      </span>
                      <span className="deliv-stars-empty">
                        {'☆'.repeat(5 - submittedFeedback.rating)}
                      </span>
                      <span className="deliv-rating-badge">
                        {submittedFeedback.rating} / 5 Stars
                      </span>
                    </div>
                    <button
                      type="button"
                      className="deliv-edit-feedback-btn"
                      onClick={() => setIsEditing(true)}
                    >
                      ✏️ Edit Feedback
                    </button>
                  </div>

                  {submittedFeedback.feedback ? (
                    <p className="deliv-feedback-submitted-quote">
                      "{submittedFeedback.feedback}"
                    </p>
                  ) : (
                    <p className="deliv-feedback-submitted-quote" style={{ fontStyle: 'italic', color: '#64748b' }}>
                      (No written comment provided)
                    </p>
                  )}

                  <small className="deliv-feedback-date">
                    Feedback recorded for Courier {order.agentName || 'Partner'}
                  </small>
                </div>
              ) : (
                /* Interactive Feedback Form (Uncompacted, Roomy) */
                <form className="deliv-feedback-form" onSubmit={handleSubmitFeedback}>
                  <div className="deliv-feedback-form-title">
                    <span>⭐ Rate Your Delivery Experience</span>
                    <small>Only you as the customer can submit feedback for this delivery</small>
                  </div>

                  {/* 5 Big Touch-Friendly Stars */}
                  <div className="deliv-star-picker">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`deliv-star-choice ${s <= rating ? 'active' : ''}`}
                        onClick={() => setRating(s)}
                        title={`${s} Star${s > 1 ? 's' : ''}`}
                        aria-label={`Select ${s} stars`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="deliv-star-desc">
                      {rating === 5 ? 'Excellent 🌟' : rating === 4 ? 'Good 👍' : rating === 3 ? 'Average 👌' : rating === 2 ? 'Poor 👎' : 'Terrible ⚠️'}
                    </span>
                  </div>

                  {/* Spacious Feedback Comment Textarea */}
                  <div className="deliv-comment-wrap">
                    <textarea
                      className="deliv-comment-input"
                      rows={3}
                      placeholder="Share your thoughts (delivery speed, package condition, courier friendliness)..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                    />
                  </div>

                  <div className="deliv-feedback-actions">
                    <button
                      type="submit"
                      className="deliv-feedback-submit-btn"
                      disabled={submittingFeedback}
                    >
                      {submittingFeedback ? 'Submitting...' : '✓ Submit Customer Review'}
                    </button>
                    {submittedFeedback && (
                      <button
                        type="button"
                        className="deliv-feedback-cancel-btn"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spacious Uncompacted Action Buttons (Mobile-Screen Friendly) */}
      <div className="deliv-actions-bar">
        <button
          type="button"
          className="deliv-btn-primary"
          onClick={() => nav('/user/new')}
        >
          <span className="deliv-btn-icon">🛍️</span>
          <span>Order Again Now</span>
          <span className="deliv-btn-arrow">→</span>
        </button>

        {onOpenReceipt && (
          <button
            type="button"
            className="deliv-btn-secondary"
            onClick={onOpenReceipt}
          >
            <span>📄</span>
            <span>View Tax Invoice / Receipt</span>
          </button>
        )}

        <button
          type="button"
          className="deliv-btn-secondary"
          onClick={handleSendDeliveredEmail}
          disabled={sendingEmail}
          title="Send delivery receipt & Thank You message to customer's registered email"
        >
          <span>{sendingEmail ? '⏳' : '📧'}</span>
          <span>{sendingEmail ? 'Sending Email...' : 'Send Delivery Email'}</span>
        </button>
      </div>
    </div>
  );
}
