import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AtmosphereScreen } from '../src/components/AtmosphereScreen';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../src/constants/theme';

const EFFECTIVE_DATE = 'March 10, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <AtmosphereScreen>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>Legal</Text>
          <Text style={styles.title}>Privacy Policy</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Paragraph>
          Effective date: {EFFECTIVE_DATE}
        </Paragraph>
        <Paragraph>
          BDQ Holdings LLC ("we", "our", or "us") operates the RadianceIQ mobile
          application. This Privacy Policy explains how we collect, use, store,
          and protect your personal information when you use our app.
        </Paragraph>
        <Paragraph>
          By using RadianceIQ, you agree to the collection and use of information
          in accordance with this policy.
        </Paragraph>
      </View>

      {/* 1. Data We Collect */}
      <View style={styles.card}>
        <Section title="1. Information We Collect">
          <Paragraph>
            We collect the following categories of information to provide and
            improve our skin health tracking service:
          </Paragraph>
          <BulletList
            items={[
              'Account information: email address, name, and authentication credentials managed through our identity provider (Clerk).',
              'Skin scan photos: images captured via your device camera during baseline and daily scans.',
              'Health metrics: skin analysis scores, signal data (structure, hydration, inflammation, sun damage, elasticity), and trend history.',
              'Product usage data: skincare products you add, ingredient lists, and usage schedules.',
              'Demographic information: age range, location (coarse), period tracking preference, and lifestyle factors you optionally provide during onboarding.',
              'Device information: device type, operating system, and app version for troubleshooting purposes.',
            ]}
          />
        </Section>
      </View>

      {/* 2. How We Use Your Data */}
      <View style={styles.card}>
        <Section title="2. How We Use Your Data">
          <Paragraph>
            Your information is used exclusively to deliver and improve the
            RadianceIQ experience:
          </Paragraph>
          <BulletList
            items={[
              'Skin analysis: processing scan photos to generate skin health scores and identify trends over time.',
              'Trend tracking: comparing daily scans against your baseline to monitor changes in skin health signals.',
              'Personalized recommendations: tailoring product effectiveness scores and insights based on your skin profile and goals.',
              'Service improvement: aggregated, anonymized usage patterns help us improve the app experience.',
            ]}
          />
          <Paragraph>
            We do not sell your personal data to third parties. We do not use
            your data for advertising purposes.
          </Paragraph>
        </Section>
      </View>

      {/* 3. Data Storage */}
      <View style={styles.card}>
        <Section title="3. Data Storage and Security">
          <Paragraph>
            Your data is stored in two locations:
          </Paragraph>
          <BulletList
            items={[
              'Local device storage: scan photos, analysis results, and user preferences are stored on your device using secure local storage (AsyncStorage).',
              'Encrypted backend: account data and scan history are synced to our secure PostgreSQL database, encrypted in transit (TLS) and at rest.',
            ]}
          />
          <Paragraph>
            We implement industry-standard security measures to protect your data
            against unauthorized access, alteration, disclosure, or destruction.
          </Paragraph>
        </Section>
      </View>

      {/* 4. Third-Party Services */}
      <View style={styles.card}>
        <Section title="4. Third-Party Services">
          <Paragraph>
            RadianceIQ integrates with the following third-party services:
          </Paragraph>
          <BulletList
            items={[
              'Clerk (authentication): manages user sign-up, sign-in, and session tokens. Clerk processes your email address and authentication credentials. See Clerk\'s privacy policy at clerk.com/privacy.',
              'OpenAI (vision analysis): scan photos may be sent to OpenAI\'s API for AI-powered skin analysis. Photos are sent for analysis only and are not stored or used for training by OpenAI, per our API data usage agreement. See OpenAI\'s API data usage policy at openai.com/policies/api-data-usage-policies.',
            ]}
          />
          <Paragraph>
            No other third-party services receive your personal data or scan
            photos.
          </Paragraph>
        </Section>
      </View>

      {/* 5. User Rights */}
      <View style={styles.card}>
        <Section title="5. Your Rights (GDPR / CCPA)">
          <Paragraph>
            Depending on your jurisdiction, you have the following rights
            regarding your personal data:
          </Paragraph>
          <BulletList
            items={[
              'Right to access: request a copy of the personal data we hold about you.',
              'Right to deletion: request that we delete all personal data associated with your account.',
              'Right to portability: request your data in a structured, machine-readable format.',
              'Right to rectification: request correction of inaccurate personal data.',
              'Right to restrict processing: request that we limit how we use your data.',
              'Right to object: object to processing of your personal data for specific purposes.',
              'Right to opt out of sale: we do not sell personal data, but you may exercise this right at any time.',
            ]}
          />
          <Paragraph>
            To exercise any of these rights, contact us at drmustafa@bdqholdings.com.
            We will respond within 30 days.
          </Paragraph>
        </Section>
      </View>

      {/* 6. Data Retention */}
      <View style={styles.card}>
        <Section title="6. Data Retention">
          <Paragraph>
            We retain your data for as long as your account is active. You can
            delete all of your data at any time through the Profile screen in the
            app by using the "Reset all data" option, or by contacting us
            directly.
          </Paragraph>
          <Paragraph>
            Upon account deletion, all associated data (scan photos, health
            metrics, product information, and account details) is permanently
            removed from our servers within 30 days.
          </Paragraph>
        </Section>
      </View>

      {/* 7. Camera and Photo Permissions */}
      <View style={styles.card}>
        <Section title="7. Camera and Photo Permissions">
          <Paragraph>
            RadianceIQ requires camera access to perform skin scans. Photos
            captured during scans are:
          </Paragraph>
          <BulletList
            items={[
              'Stored locally on your device.',
              'Optionally sent to our backend for AI-powered analysis (encrypted in transit).',
              'Never shared with third parties for marketing or advertising.',
              'Never posted publicly or made accessible to other users.',
            ]}
          />
          <Paragraph>
            You can revoke camera permissions at any time through your device
            settings. Without camera access, the scan feature will be unavailable.
          </Paragraph>
        </Section>
      </View>

      {/* 8. Health Data */}
      <View style={styles.card}>
        <Section title="8. Health Data Disclaimer">
          <Paragraph>
            RadianceIQ provides skin health tracking for informational purposes
            only. Our analysis is non-diagnostic and should not be considered
            medical advice.
          </Paragraph>
          <BulletList
            items={[
              'Skin health scores and signals are generated using algorithmic analysis and AI, not clinical evaluation.',
              'Results are not a substitute for professional dermatological consultation.',
              'Health-related data (skin metrics, trends) is never shared with third parties, including insurance companies or employers.',
            ]}
          />
          <Paragraph>
            If you have concerns about a skin condition, please consult a
            qualified healthcare professional.
          </Paragraph>
        </Section>
      </View>

      {/* 9. Children's Privacy */}
      <View style={styles.card}>
        <Section title="9. Children's Privacy">
          <Paragraph>
            RadianceIQ is not intended for use by individuals under the age of
            13. We do not knowingly collect personal information from children
            under 13. If we become aware that we have collected data from a child
            under 13, we will take steps to delete that information promptly.
          </Paragraph>
          <Paragraph>
            If you are a parent or guardian and believe your child has provided us
            with personal data, please contact us at drmustafa@bdqholdings.com.
          </Paragraph>
        </Section>
      </View>

      {/* 10. Changes to This Policy */}
      <View style={styles.card}>
        <Section title="10. Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time. Changes will be
            posted within the app, and the "Effective date" at the top will be
            revised accordingly. Continued use of RadianceIQ after changes
            constitutes acceptance of the updated policy.
          </Paragraph>
          <Paragraph>
            For material changes, we will provide prominent notice within the app
            or via email.
          </Paragraph>
        </Section>
      </View>

      {/* 11. Contact */}
      <View style={styles.card}>
        <Section title="11. Contact Information">
          <Paragraph>
            If you have questions or concerns about this Privacy Policy or our
            data practices, please contact us:
          </Paragraph>
          <BulletList
            items={[
              'Company: BDQ Holdings LLC',
              'Email: drmustafa@bdqholdings.com',
              'Subject line: RadianceIQ Privacy Inquiry',
            ]}
          />
        </Section>
      </View>

      <View style={styles.footerSpacer} />
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: Spacing.xxs,
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  card: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  bulletList: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  footerSpacer: {
    height: Spacing.xl,
  },
});
