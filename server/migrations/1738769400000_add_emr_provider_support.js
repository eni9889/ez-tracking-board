const shorthands = undefined;

async function up(pgm) {
  // Add emr_provider column to user_credentials table
  pgm.addColumn('user_credentials', {
    emr_provider: { 
      type: 'varchar(20)', 
      default: "'EZDERM'",
      notNull: true 
    }
  }, {
    ifNotExists: true
  });

  // Add emr_provider column to stored_tokens table  
  pgm.addColumn('stored_tokens', {
    emr_provider: { 
      type: 'varchar(20)', 
      default: "'EZDERM'",
      notNull: true 
    }
  }, {
    ifNotExists: true
  });

  // Create index on emr_provider for better performance
  pgm.createIndex('user_credentials', 'emr_provider', { ifNotExists: true });
  pgm.createIndex('stored_tokens', 'emr_provider', { ifNotExists: true });

  // Update existing records to have EZDERM as default EMR provider
  pgm.sql("UPDATE user_credentials SET emr_provider = 'EZDERM' WHERE emr_provider IS NULL");
  pgm.sql("UPDATE stored_tokens SET emr_provider = 'EZDERM' WHERE emr_provider IS NULL");
}

async function down(pgm) {
  // Remove emr_provider columns
  pgm.dropColumn('user_credentials', 'emr_provider');
  pgm.dropColumn('stored_tokens', 'emr_provider');
}

module.exports = { up, down, shorthands };
