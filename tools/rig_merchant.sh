#!/bin/sh
# the merchant rig, cut from his approved sprite: the head nods and turns on the neck, both arms in two bones (L = screen left);
# his legs stay in the body: the counter hides them
set -e
python3 tools/robecut.py merchant art/gen/merchant.png \
 "L:upper|16,94;86,94;84,120;74,152;4,160;2,126|fore|0,150;66,150;62,172;52,200;50,228;0,228|sh|52,100|elbow|30,148|hand|26,206" \
 "R:upper|180,94;250,94;264,124;264,160;196,152;182,120|fore|200,150;266,150;266,228;220,228;210,196;204,170|sh|214,100|elbow|236,148|hand|240,206" \
 "H:head|62,0;180,0;180,30;182,62;178,90;160,112;120,114;100,100;94,78;78,64;58,58|neck|134,96"
