/*__________________________________________________________________________________________

                                        USER MODEL

    Defining structure of the User container/collection in the database
__________________________________________________________________________________________*/


  const mongoose              = require('mongoose');


  const UserSchema = new mongoose.Schema
      (
          {
              username:     {   type:       String,
                                required:   true,
                                unique:     true,
                                trim:       true,
                                lowercase:  true
                            },


              password:     {   type:       String,
                                required:   true
                            },


              firstName:    {   type:       String,
                                trim:       true,
                                default:    ""
                            },


              role:         {   type:     String,
                                enum:     ['CLIENT', 'CONTRACTOR'],
                                default:  'CLIENT'
                            },


        /*  _____ VERIFICATION FIELDS _____ */

              isVerified:       {     type:    Boolean,   default: false  },  // STORES --> IF contractor verified by admin
              licenseNumber:    {     type:    String,    default: ""     },  // STORES --> license # for contractors
              idPhotoPath:      {     type:    String,    default: ""     },  // STORES --> filename of uploaded license
              instagram:        {     type:    String,    default: ""     },  // STORES --> Contractor instagram handle


        /*  _____ RATING SYSTEM _____ */

              ratings:
                  [
                      {
                          from:    String,                              // rated persons Username
                          score:   { type: Number, min: 1, max: 5 },   // score --> x/5
                          comment: String,                              // comment
                          date:    { type: Date, default: Date.now }    // date
                      }
                  ]
          }
      );


  module.exports = mongoose.model('User', UserSchema);
